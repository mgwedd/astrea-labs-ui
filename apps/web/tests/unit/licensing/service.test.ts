// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/licensing/db/schema';
import { emailSends, licenses } from '@/lib/licensing/db/schema';
import type { Mail } from '@/lib/licensing/email';
import {
  addMonths,
  buildRevocationList,
  DEFAULT_LICENSE_MONTHS,
  issueLicense,
  KEY_LINK_TTL_DAYS,
  reissueLicense,
  requestLicense,
  revealKeyLink,
  revokeLicense,
  runRenewals,
  RATE_LIMIT,
  tokenFor,
  type Db,
  type Deps,
} from '@/lib/licensing/service';
import {
  LICENSE_PREFIX,
  publicKeyFromRaw,
  rawPublicKey,
  REVOCATIONS_PREFIX,
  verifyLicense,
  verifySigned,
  type RevocationsPayload,
} from '@/lib/licensing/token';

const DAY = 86_400_000;
const key = { kid: 'test-1', privateKey: generateKeyPairSync('ed25519').privateKey };
const pub = { 'test-1': publicKeyFromRaw(rawPublicKey(key.privateKey)) };

let sent: Mail[];
let clock: Date;
let deps: Deps;

beforeEach(async () => {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, '../../../drizzle') });
  sent = [];
  clock = new Date('2026-11-01T12:34:56.789Z');
  deps = {
    db: db as unknown as Db,
    key,
    mailer: { send: async (m) => void sent.push(m) },
    downloadUrl: 'https://github.com/mgwedd/aletheia/releases/latest',
    siteUrl: 'https://astrealabs.test',
    now: () => clock,
  };
});

const nowS = () => Math.floor(clock.getTime() / 1000);
const linkIn = (m: Mail) => m.text.match(/\/aletheia\/beta\/key\?t=([\w-]{43})/)![1];

/** Opens the key link in an email and returns the key it reveals. */
async function keyIn(m: Mail): Promise<string> {
  const r = await revealKeyLink(deps, linkIn(m));
  if (!r.ok) throw new Error(`key link ${r.reason}`);
  return r.token;
}

/** A non-expiring license, as an admin (or approval) would create it. No email. */
async function issue(email: string, updatesOptIn = false) {
  return issueLicense(deps, email, updatesOptIn, null);
}

/** Issues a license, then has an admin reissue it with an expiry `days` from now. Returns the expiring row. */
async function issueExpiring(email: string, days: number) {
  const first = await issue(email);
  return (await reissueLicense(deps, first.lid, { expiresAt: new Date(clock.getTime() + days * DAY) }))!;
}

describe('claims in minted tokens', () => {
  it('a beta token carries the fixed claims and no acc without an agreement', async () => {
    const r = verifyLicense(tokenFor(await issue('plain@example.com'), key), pub, nowS());
    expect(r.ok && r.payload.cl).toEqual(['no-baa', 'beta-no-sla']);
    expect(r.ok && 'acc' in r.payload).toBe(false);
  });
});

describe('issueLicense', () => {
  it('defaults to a 12-month expiry when none is passed', async () => {
    const row = await issueLicense(deps, 'default@example.com', false);
    expect(DEFAULT_LICENSE_MONTHS).toBe(12);
    expect(row.expiresAt!.getTime()).toBe(Math.floor(addMonths(clock, 12).getTime() / 1000) * 1000);
  });

  it('creates a non-expiring license whose token verifies', async () => {
    const row = await issue('ann@example.com');
    const r = verifyLicense(tokenFor(row, key), pub, nowS());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload).toMatchObject({ v: 1, kid: 'test-1', sub: 'ann@example.com', tier: 'beta', iat: nowS() });
    expect(r.payload).not.toHaveProperty('exp');
    expect(r.payload.lid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(sent).toHaveLength(0);
  });
});

describe('requestLicense (resend only)', () => {
  it('sends nothing to an address without a license', async () => {
    expect(await requestLicense(deps, { email: 'nobody@example.com' })).toBe('none');
    expect(sent).toHaveLength(0);
    expect(await deps.db.select().from(licenses)).toHaveLength(0);
    expect(await deps.db.select().from(emailSends)).toHaveLength(0);
  });

  it('emails a key link, never the key, and the link reveals the license', async () => {
    const row = await issue('ann@example.com');
    expect(await requestLicense(deps, { email: ' Ann@Example.com ' })).toBe('resent');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('ann@example.com');
    expect(sent[0].text).toContain(deps.downloadUrl);
    expect(sent[0].text).toContain('https://astrealabs.test/aletheia/beta/key?t=');
    expect(sent[0].text).toContain('does not expire');
    expect(sent[0].text + sent[0].html).not.toContain(LICENSE_PREFIX + '.');
    expect(await keyIn(sent[0])).toBe(tokenFor(row, key));
  });

  it('resends the identical key for an address with an active license', async () => {
    await issue('ann@example.com');
    await requestLicense(deps, { email: 'ann@example.com' });
    const first = await keyIn(sent[0]);
    clock = new Date(clock.getTime() + 2 * 3600_000);
    expect(await requestLicense(deps, { email: 'ANN@example.com' })).toBe('resent');
    expect(await keyIn(sent[1])).toBe(first);
    expect(await deps.db.select().from(licenses)).toHaveLength(1);
  });

  it('does not resend to an address whose license was revoked', async () => {
    const row = await issue('ann@example.com');
    await revokeLicense(deps, row.lid, 'abuse');
    expect(await requestLicense(deps, { email: 'ann@example.com' })).toBe('blocked');
    expect(sent).toHaveLength(0);
    expect(await deps.db.select().from(licenses)).toHaveLength(1);
    // An admin reissue lifts the block.
    await reissueLicense(deps, row.lid);
    expect(await requestLicense(deps, { email: 'ann@example.com' })).toBe('resent');
  });

  it('rate-limits per address per hour', async () => {
    await issue('a@example.com');
    await issue('b@example.com');
    for (let i = 0; i < RATE_LIMIT.perHour; i++) await requestLicense(deps, { email: 'a@example.com' });
    expect(await requestLicense(deps, { email: 'a@example.com' })).toBe('rate_limited');
    expect(sent).toHaveLength(RATE_LIMIT.perHour);
    expect(await requestLicense(deps, { email: 'b@example.com' })).toBe('resent');
  });

  it('re-issues under the active key when the stored license used a retired key', async () => {
    await issue('ann@example.com');
    const newKey = { kid: 'test-2', privateKey: generateKeyPairSync('ed25519').privateKey };
    deps = { ...deps, key: newKey };
    clock = new Date(clock.getTime() + 2 * 3600_000);
    expect(await requestLicense(deps, { email: 'ann@example.com' })).toBe('resent');
    const r = verifyLicense(await keyIn(sent[0]), { 'test-2': publicKeyFromRaw(rawPublicKey(newKey.privateKey)) }, nowS());
    expect(r.ok).toBe(true);
  });
});

describe('key links', () => {
  it('work once', async () => {
    await issue('ann@example.com');
    await requestLicense(deps, { email: 'ann@example.com' });
    const t = linkIn(sent[0]);
    expect((await revealKeyLink(deps, t)).ok).toBe(true);
    expect(await revealKeyLink(deps, t)).toEqual({ ok: false, reason: 'used' });
  });

  it('can be opened by only one of two concurrent requests', async () => {
    await issue('ann@example.com');
    await requestLicense(deps, { email: 'ann@example.com' });
    const t = linkIn(sent[0]);
    const results = await Promise.all([revealKeyLink(deps, t), revealKeyLink(deps, t)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it('expire after 7 days', async () => {
    await issue('ann@example.com');
    await requestLicense(deps, { email: 'ann@example.com' });
    clock = new Date(clock.getTime() + KEY_LINK_TTL_DAYS * DAY + 1);
    expect(await revealKeyLink(deps, linkIn(sent[0]))).toEqual({ ok: false, reason: 'expired' });
  });

  it('stop working when a newer link is sent', async () => {
    await issue('ann@example.com');
    await requestLicense(deps, { email: 'ann@example.com' });
    await requestLicense(deps, { email: 'ann@example.com' });
    expect((await revealKeyLink(deps, linkIn(sent[0]))).ok).toBe(false);
    expect((await revealKeyLink(deps, linkIn(sent[1]))).ok).toBe(true);
  });

  it('refuse a revoked license, and unknown or malformed tokens', async () => {
    const row = await issue('ann@example.com');
    await requestLicense(deps, { email: 'ann@example.com' });
    await revokeLicense(deps, row.lid, 'abuse');
    expect(await revealKeyLink(deps, linkIn(sent[0]))).toEqual({ ok: false, reason: 'invalid' });
    expect(await revealKeyLink(deps, 'A'.repeat(43))).toEqual({ ok: false, reason: 'invalid' });
    expect(await revealKeyLink(deps, 'short')).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('reissue and renewal', () => {
  it('reissue gives a new lid, keeps it non-expiring, links the old one, and can revoke it', async () => {
    const old = await issue('ann@example.com', true);
    clock = new Date(clock.getTime() + 10 * DAY);
    const created = await reissueLicense(deps, old.lid, { revokeOld: true, reason: 'lost device' });
    expect(created!.lid).not.toBe(old.lid);
    expect(created!.expiresAt).toBeNull();
    expect(created!.updatesOptIn).toBe(true);
    const [after] = await deps.db.select().from(licenses).where(eq(licenses.lid, old.lid));
    expect(after.replacedBy).toBe(created!.lid);
    expect(after.revokedReason).toBe('lost device');
    expect(sent.at(-1)!.subject).toMatch(/new/i);
    expect(await keyIn(sent.at(-1)!)).toBe(tokenFor(created!, key));
  });

  it('reissue with expiresAt sets an expiry, and null removes it', async () => {
    const expiring = await issueExpiring('ann@example.com', 30);
    const r = verifyLicense(await keyIn(sent.at(-1)!), pub, nowS());
    expect(r.ok && r.payload.exp).toBe(nowS() + 30 * 86_400);

    // Without expiresAt, an expiring license keeps its length.
    const same = await reissueLicense(deps, expiring.lid);
    expect(same!.expiresAt!.getTime() - same!.issuedAt.getTime()).toBe(30 * DAY);

    const forever = await reissueLicense(deps, expiring.lid, { expiresAt: null });
    expect(forever!.expiresAt).toBeNull();
    const f = verifyLicense(await keyIn(sent.at(-1)!), pub, nowS() + 10_000 * 86_400);
    expect(f.ok && f.payload).not.toHaveProperty('exp');
  });

  it('never renews or expires a non-expiring license', async () => {
    const row = await issue('ann@example.com');
    clock = new Date(clock.getTime() + 5000 * DAY);
    expect(await runRenewals(deps)).toEqual({ renewed: 0, failed: [] });
    expect(await requestLicense(deps, { email: 'ann@example.com' })).toBe('resent');
    expect(await keyIn(sent[0])).toBe(tokenFor(row, key));
  });

  it('renews only expiring licenses inside the 14-day window, once', async () => {
    await issueExpiring('soon@example.com', 90);
    await issue('forever@example.com');
    clock = new Date(clock.getTime() + 30 * DAY);
    await issueExpiring('later@example.com', 90);
    clock = new Date(clock.getTime() + 47 * DAY); // soon: 13 days left; later: 43 days left

    expect(await runRenewals(deps)).toEqual({ renewed: 1, failed: [] });
    expect(sent.at(-1)!.to).toBe('soon@example.com');
    expect(sent.at(-1)!.subject).toMatch(/renewed/i);
    expect(sent.at(-1)!.text).not.toContain(LICENSE_PREFIX + '.');
    const renewed = await keyIn(sent.at(-1)!);
    const r = verifyLicense(renewed, pub, nowS());
    expect(r.ok && r.payload.exp! - nowS()).toBe(90 * 86_400);

    expect(await runRenewals(deps)).toEqual({ renewed: 0, failed: [] });
    // The renewed license is active, so a resend reveals the new token.
    expect(await requestLicense(deps, { email: 'soon@example.com' })).toBe('resent');
    expect(await keyIn(sent.at(-1)!)).toBe(renewed);
  });

  it('revoking an old lid also revokes its renewal', async () => {
    const old = await issueExpiring('ann@example.com', 90);
    clock = new Date(clock.getTime() + 80 * DAY);
    expect((await runRenewals(deps)).renewed).toBe(1);
    await revokeLicense(deps, old.lid, 'abuse');
    const rows = await deps.db.select().from(licenses);
    expect(rows).toHaveLength(3); // original (already replaced), expiring reissue, renewal
    expect(rows.filter((r) => r.lid !== old.lid && r.replacedBy !== old.lid).every((r) => r.revokedAt)).toBe(true);
    expect(rows.find((r) => r.lid === old.lid)!.revokedAt).not.toBeNull();
  });

  it('retries a renewal whose email failed', async () => {
    await issueExpiring('ann@example.com', 90);
    clock = new Date(clock.getTime() + 80 * DAY);
    const working = deps.mailer;
    deps = { ...deps, mailer: { send: async () => { throw new Error('mail down'); } } };
    expect((await runRenewals(deps)).failed).toHaveLength(1);
    expect(await deps.db.select().from(licenses)).toHaveLength(2);
    deps = { ...deps, mailer: working };
    expect(await runRenewals(deps)).toEqual({ renewed: 1, failed: [] });
  });

  it('reissuing an already-replaced lid replaces the newest license, not the old one', async () => {
    const first = await issue('ann@example.com');
    const second = await reissueLicense(deps, first.lid);
    const third = await reissueLicense(deps, first.lid);
    const [secondAfter] = await deps.db.select().from(licenses).where(eq(licenses.lid, second!.lid));
    expect(secondAfter.replacedBy).toBe(third!.lid);
  });

  it('logs each send for rate limiting', async () => {
    await issue('ann@example.com');
    await requestLicense(deps, { email: 'ann@example.com' });
    const rows = await deps.db.select().from(emailSends);
    expect(rows.map((r) => r.kind)).toEqual(['key-link']);
  });
});

describe('buildRevocationList', () => {
  it('lists revoked, unexpired lids, signed, with an hour-bucketed iat', async () => {
    const a = await issueExpiring('a@example.com', 90);
    await issue('b@example.com');
    await revokeLicense(deps, a.lid, 'test');

    const body = await buildRevocationList(deps);
    const r = verifySigned<RevocationsPayload>(REVOCATIONS_PREFIX, body, pub);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.revoked).toEqual([a.lid]);
    expect(r.payload.iat % 3600).toBe(0);
    expect(r.payload.next).toBe(r.payload.iat + 3600);

    clock = new Date(clock.getTime() + 60_000);
    expect(await buildRevocationList(deps)).toBe(body); // same bytes within the hour

    clock = new Date(clock.getTime() + 91 * DAY);
    const later = verifySigned<RevocationsPayload>(REVOCATIONS_PREFIX, await buildRevocationList(deps), pub);
    expect(later.ok && later.payload.revoked).toEqual([]); // expired entries are pruned

    const [b] = await deps.db.select().from(licenses).where(eq(licenses.email, 'b@example.com'));
    await revokeLicense(deps, b.lid, 'test');
    clock = new Date(clock.getTime() + 5000 * DAY);
    const much = verifySigned<RevocationsPayload>(REVOCATIONS_PREFIX, await buildRevocationList(deps), pub);
    expect(much.ok && much.payload.revoked).toEqual([b.lid]); // non-expiring entries stay
  });
});
