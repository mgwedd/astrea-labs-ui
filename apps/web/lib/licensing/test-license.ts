// Short-lived test licenses the owner keeps on hand to try new builds before
// telling users. Signed with the production key, so release builds accept them.
// At most MAX_LIVE_TEST_LICENSES are live at once, and a row is deleted as soon as
// its license expires, so nothing piles up. No email, no key link, no license row.
// The token is never stored; it is rebuilt from the row (Ed25519 is deterministic).
import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, gt, isNull, lte } from 'drizzle-orm';
import { testLicenses, type TestLicense } from './db/schema';
import type { Db } from './service';
import { CLAIMS_BY_TIER, signLicense, type LicensePayload, type SigningKey } from './token';

export const TEST_LICENSE_DAYS = [1, 3, 7, 30] as const;
export type TestLicenseDays = (typeof TEST_LICENSE_DAYS)[number];
export const MAX_LIVE_TEST_LICENSES = 3;

type TestDeps = { db: Db; key: SigningKey; now?: () => Date };

const toUnix = (d: Date) => Math.floor(d.getTime() / 1000);
const live = (now: Date) => and(isNull(testLicenses.revokedAt), gt(testLicenses.expiresAt, now));

/** Deletes every test license that has run out. */
export async function pruneTestLicenses(deps: Pick<TestDeps, 'db' | 'now'>): Promise<void> {
  const now = deps.now?.() ?? new Date();
  await deps.db.delete(testLicenses).where(lte(testLicenses.expiresAt, now));
}

/** Unexpired test licenses, revoked ones included, soonest to expire first. */
export async function listTestLicenses(deps: Pick<TestDeps, 'db' | 'now'>): Promise<TestLicense[]> {
  await pruneTestLicenses(deps);
  return deps.db.select().from(testLicenses).orderBy(asc(testLicenses.expiresAt));
}

export async function createTestLicense(
  deps: TestDeps,
  input: { days: TestLicenseDays; label: string; by: string },
): Promise<{ ok: true; license: TestLicense } | { ok: false; error: 'limit' }> {
  if (!TEST_LICENSE_DAYS.includes(input.days)) throw new Error(`test licenses last ${TEST_LICENSE_DAYS.join(', ')} days`);
  const now = deps.now?.() ?? new Date();
  await pruneTestLicenses(deps);
  const [{ n }] = await deps.db.select({ n: count() }).from(testLicenses).where(live(now));
  if (n >= MAX_LIVE_TEST_LICENSES) return { ok: false, error: 'limit' };
  const iat = toUnix(now);
  const [license] = await deps.db
    .insert(testLicenses)
    .values({
      lid: `test-${randomUUID()}`,
      label: input.label,
      kid: deps.key.kid,
      issuedAt: new Date(iat * 1000),
      expiresAt: new Date((iat + input.days * 86_400) * 1000),
      createdBy: input.by,
    })
    .returning();
  return { ok: true, license: license! };
}

/** The exact token for a test license. Throws if it was signed with a key that is no longer active. */
export function testLicenseToken(license: TestLicense, key: SigningKey): string {
  if (license.kid !== key.kid) throw new Error(`test license ${license.lid} was signed with ${license.kid}`);
  const payload: LicensePayload = {
    v: 1,
    kid: license.kid,
    lid: license.lid,
    sub: `Test license: ${license.label}`,
    tier: 'test',
    iat: toUnix(license.issuedAt),
    exp: toUnix(license.expiresAt),
    cl: [...CLAIMS_BY_TIER.test],
  };
  return signLicense(payload, key);
}

/** The token of a live test license, or null if it is missing, revoked or expired. */
export async function revealTestLicense(deps: TestDeps, lid: string): Promise<string | null> {
  const now = deps.now?.() ?? new Date();
  const [license] = await deps.db.select().from(testLicenses).where(and(eq(testLicenses.lid, lid), live(now))).limit(1);
  return license ? testLicenseToken(license, deps.key) : null;
}

/** Revokes a test license. It stays on the revocation list until it would have expired. */
export async function revokeTestLicense(deps: Pick<TestDeps, 'db' | 'now'>, lid: string): Promise<boolean> {
  const now = deps.now?.() ?? new Date();
  const rows = await deps.db
    .update(testLicenses)
    .set({ revokedAt: now })
    .where(and(eq(testLicenses.lid, lid), live(now)))
    .returning({ lid: testLicenses.lid });
  return rows.length > 0;
}
