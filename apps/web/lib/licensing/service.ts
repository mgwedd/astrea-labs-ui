// Issue, resend, revoke, re-issue and renew Aletheia licenses.
// Everything takes its dependencies (db, key, mailer, clock) as arguments so it
// runs the same against Neon in production and PGlite in tests.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './db/schema';
import { betaApplications, emailSends, keyLinks, licenses, type License } from './db/schema';
import { keyLinkEmail, type KeyLinkKind, type Mailer } from './email';
import { acceptanceFor } from './acceptance';
import {
  CLAIMS_BY_TIER,
  signLicense,
  signRevocations,
  type Acceptance,
  type LicensePayload,
  type SigningKey,
} from './token';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Spec G: about 30 days before expiry, ahead of the app's own 14-day warning.
// A renewed key is shown only after the licensee confirms C2 again (see revealKeyLink).
export const RENEWAL_WINDOW_DAYS = 30;
export const KEY_LINK_TTL_DAYS = 7;
/** Default license length when the caller doesn't pass an expiry. */
export const DEFAULT_LICENSE_MONTHS = 12;
export const RATE_LIMIT = { perHour: 3, perDay: 6 };

const DAY_MS = 86_400_000;
const HOUR_S = 3600;

/** `months` calendar months after `from` (UTC). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export type Deps = {
  db: Db;
  key: SigningKey;
  mailer: Mailer;
  downloadUrl: string;
  /** Origin for links in emails, no trailing slash. See siteUrlFor in server.ts. */
  siteUrl: string;
  now?: () => Date;
};

/** A link secret: 32 random bytes, base64url. Only its hash is stored. */
export function newLinkToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex of a link or session secret. Lookups go by this hash. */
export function hashLinkToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Shape check before hashing: 32 bytes base64url is 43 characters. */
export function looksLikeLinkToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** Whole seconds, so stored timestamps round-trip to the exact token iat/exp. */
function wholeSeconds(d: Date): Date {
  return new Date(Math.floor(d.getTime() / 1000) * 1000);
}

const toUnix = (d: Date) => Math.floor(d.getTime() / 1000);

/** Licenses with no expiry, or one still in the future. */
const unexpired = (now: Date) => or(isNull(licenses.expiresAt), gt(licenses.expiresAt, now));

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Rebuilds the exact token for a stored license. Tokens themselves are never stored. */
export function tokenFor(license: License, key: SigningKey, accepted: Acceptance[] = []): string {
  if (license.kid !== key.kid) {
    throw new Error(`license ${license.lid} was signed with ${license.kid}, active key is ${key.kid}`);
  }
  const payload: LicensePayload = {
    v: 1,
    kid: license.kid,
    lid: license.lid,
    sub: license.email,
    tier: 'beta',
    iat: toUnix(license.issuedAt),
    ...(license.expiresAt ? { exp: toUnix(license.expiresAt) } : {}),
    ...(accepted.length ? { acc: accepted } : {}),
    cl: [...CLAIMS_BY_TIER.beta],
  };
  return signLicense(payload, key);
}

/** Inserts a license row (no email). Leaving expiresAt out gives DEFAULT_LICENSE_MONTHS;
 *  pass null only for a license that never expires. */
export async function issueLicense(
  deps: Deps,
  email: string,
  updatesOptIn: boolean,
  expiresAt?: Date | null,
  opts: { attestationRequired?: boolean } = {},
): Promise<License> {
  const now = deps.now?.() ?? new Date();
  const issuedAt = wholeSeconds(now);
  if (expiresAt === undefined) expiresAt = addMonths(now, DEFAULT_LICENSE_MONTHS);
  const [row] = await deps.db
    .insert(licenses)
    .values({
      lid: randomUUID(),
      email,
      updatesOptIn,
      kid: deps.key.kid,
      issuedAt,
      expiresAt: expiresAt && wholeSeconds(expiresAt),
      attestationRequired: opts.attestationRequired ?? false,
    })
    .returning();
  return row;
}

/**
 * Creates a single-use key link for a license and emails it. Earlier unused
 * links for the same license stop working. The token itself is never emailed.
 */
export async function sendKeyLink(
  deps: Deps,
  license: License,
  kind: KeyLinkKind,
  applicationId: string | null = null,
): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const token = newLinkToken();
  const expiresAt = new Date(now.getTime() + KEY_LINK_TTL_DAYS * DAY_MS);
  await deps.db
    .update(keyLinks)
    .set({ expiresAt: now })
    .where(and(eq(keyLinks.lid, license.lid), isNull(keyLinks.usedAt), gt(keyLinks.expiresAt, now)));
  if (applicationId === null) {
    const [app] = await deps.db
      .select({ id: betaApplications.id })
      .from(betaApplications)
      .where(eq(betaApplications.lid, license.lid))
      .limit(1);
    applicationId = app?.id ?? null;
  }
  await deps.db.insert(keyLinks).values({
    id: randomUUID(),
    lid: license.lid,
    applicationId,
    tokenHash: hashLinkToken(token),
    expiresAt,
    createdAt: now,
  });
  await deps.mailer.send({
    to: license.email,
    ...keyLinkEmail({
      url: `${deps.siteUrl}/aletheia/beta/key?t=${token}`,
      linkExpiresAt: expiresAt,
      licenseExpiresAt: license.expiresAt,
      downloadUrl: deps.downloadUrl,
      siteUrl: deps.siteUrl,
      kind,
    }),
  });
  await deps.db.insert(emailSends).values({ email: license.email, kind, lid: license.lid, sentAt: now });
}

export type KeyReveal =
  | { ok: true; token: string; license: License; applicationId: string | null }
  | { ok: false; reason: 'used' | 'expired' | 'invalid' | 'attestation_required' | 'attestation_invalid' };

/** Records the licensee's re-attestation for a license. Returns false if the attestation is invalid. */
export type Attest = (license: License) => Promise<boolean>;

/**
 * Shows a key once. The link is consumed by a conditional UPDATE, so two
 * concurrent requests can't both see the key. A link to a revoked or replaced
 * license, or one signed with a retired key, is refused before it is consumed.
 *
 * A license that needs re-attestation (a renewal) is shown only once `attest`
 * records it. Without `attest` the answer is 'attestation_required' and the
 * link stays unused, so the page can ask and try again.
 */
export async function revealKeyLink(deps: Deps, token: string, attest?: Attest): Promise<KeyReveal> {
  if (!looksLikeLinkToken(token)) return { ok: false, reason: 'invalid' };
  const now = deps.now?.() ?? new Date();
  const hash = hashLinkToken(token);
  const [link] = await deps.db.select().from(keyLinks).where(eq(keyLinks.tokenHash, hash)).limit(1);
  if (!link) return { ok: false, reason: 'invalid' };
  if (link.usedAt) return { ok: false, reason: 'used' };
  if (link.expiresAt <= now) return { ok: false, reason: 'expired' };

  const [license] = await deps.db.select().from(licenses).where(eq(licenses.lid, link.lid)).limit(1);
  if (!license || license.revokedAt || license.replacedBy || license.kid !== deps.key.kid) {
    return { ok: false, reason: 'invalid' };
  }
  if (license.expiresAt && license.expiresAt <= now) return { ok: false, reason: 'expired' };

  if (license.attestationRequired && !license.attestedAt) {
    if (!attest) return { ok: false, reason: 'attestation_required' };
    if (!(await attest(license))) return { ok: false, reason: 'attestation_invalid' };
    await deps.db
      .update(licenses)
      .set({ attestedAt: now })
      .where(and(eq(licenses.lid, license.lid), isNull(licenses.attestedAt)));
  }

  const [won] = await deps.db
    .update(keyLinks)
    .set({ usedAt: now })
    .where(and(eq(keyLinks.id, link.id), isNull(keyLinks.usedAt), gt(keyLinks.expiresAt, now)))
    .returning({ id: keyLinks.id });
  if (!won) return { ok: false, reason: 'used' };
  return { ok: true, token: tokenFor(license, deps.key, await acceptanceFor(deps, license.lid)), license, applicationId: link.applicationId };
}

export async function isRateLimited(deps: Deps, email: string): Promise<boolean> {
  const now = (deps.now?.() ?? new Date()).getTime();
  const [counts] = await deps.db
    .select({
      hour: sql<number>`count(*) filter (where ${emailSends.sentAt} >= ${new Date(now - HOUR_S * 1000)})`.mapWith(Number),
      day: sql<number>`count(*)`.mapWith(Number),
    })
    .from(emailSends)
    .where(and(eq(emailSends.email, email), gte(emailSends.sentAt, new Date(now - DAY_MS))));
  return counts.hour >= RATE_LIMIT.perHour || counts.day >= RATE_LIMIT.perDay;
}

/** The newest license for an email that is not revoked, replaced or expired. Non-expiring ones sort first. */
export async function findActiveLicense(deps: Deps, email: string): Promise<License | undefined> {
  const [row] = await deps.db
    .select()
    .from(licenses)
    .where(
      and(
        eq(licenses.email, email),
        isNull(licenses.revokedAt),
        isNull(licenses.replacedBy),
        unexpired(deps.now?.() ?? new Date()),
      ),
    )
    .orderBy(sql`${licenses.expiresAt} desc nulls first`, desc(licenses.issuedAt))
    .limit(1);
  return row;
}

/**
 * An address is blocked while it has a revoked, unexpired license that was not
 * replaced. Otherwise a revoked user could just ask again. An admin reissue
 * lifts the block.
 */
async function isBlocked(deps: Deps, email: string): Promise<boolean> {
  const [row] = await deps.db
    .select({ lid: licenses.lid })
    .from(licenses)
    .where(
      and(
        eq(licenses.email, email),
        isNotNull(licenses.revokedAt),
        isNull(licenses.replacedBy),
        unexpired(deps.now?.() ?? new Date()),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export type RequestOutcome = 'resent' | 'none' | 'rate_limited' | 'blocked';

/**
 * "Lost my license": resend only. An address with an active license gets a
 * fresh single-use key link (never the key itself). Any other address gets
 * nothing; new keys come only from an approved beta application. The caller
 * must give the visitor the same response whatever the outcome.
 */
export async function requestLicense(deps: Deps, input: { email: string }): Promise<RequestOutcome> {
  const email = normalizeEmail(input.email);
  if (await isRateLimited(deps, email)) return 'rate_limited';
  if (await isBlocked(deps, email)) return 'blocked';

  const active = await findActiveLicense(deps, email);
  if (!active) return 'none';
  if (active.kid !== deps.key.kid) {
    // Signed with a retired key: replace it with one under the active key.
    await reissueLicense(deps, active.lid, { kind: 'reissue' });
    return 'resent';
  }
  await sendKeyLink(deps, active, 'key-link');
  return 'resent';
}

/** A license followed by everything that replaced it (renewals and reissues), oldest first. */
async function chainFrom(deps: Pick<Deps, 'db'>, lid: string): Promise<License[]> {
  const chain: License[] = [];
  let next: string | null = lid;
  while (next && chain.length < 1000) {
    const [row] = await deps.db.select().from(licenses).where(eq(licenses.lid, next)).limit(1);
    if (!row) break;
    chain.push(row);
    next = row.replacedBy;
  }
  return chain;
}

/**
 * Revokes a license and every license that replaced it, so revoking an old lid
 * also kills its renewal. `by` records who revoked it. Returns the license
 * asked for, or undefined if it doesn't exist or was already revoked.
 */
export async function revokeLicense(
  deps: Pick<Deps, 'db' | 'now'>,
  lid: string,
  reason: string,
  by: string,
): Promise<License | undefined> {
  const chain = await chainFrom(deps, lid);
  if (!chain.length || chain.every((l) => l.revokedAt)) return undefined;
  const rows = await deps.db
    .update(licenses)
    .set({ revokedAt: deps.now?.() ?? new Date(), revokedReason: reason, revokedBy: by })
    .where(and(inArray(licenses.lid, chain.map((l) => l.lid)), isNull(licenses.revokedAt)))
    .returning();
  return rows.find((r) => r.lid === lid) ?? rows[0];
}

/**
 * Issues a replacement with a new lid and emails it. The old license stays
 * valid unless revokeOld is set. If lid was already replaced, the newest
 * license in its chain is the one replaced.
 *
 * Expiry: pass expiresAt (a Date, or null for never). Otherwise a non-expiring
 * license stays non-expiring, and an expiring one gets the same length again
 * from now.
 * The old row is only updated after the email is sent, so a failed send
 * leaves it due for the next renewal run.
 *
 * A renewal needs re-attestation before its key is shown. A reissue keeps an
 * outstanding re-attestation, so it can't be used to skip one.
 */
export async function reissueLicense(
  deps: Deps,
  lid: string,
  opts: {
    revokeOld?: boolean;
    reason?: string;
    /** Who revoked the old license; recorded when revokeOld is set. */
    by?: string;
    kind?: 'reissue' | 'renewal';
    updatesOptIn?: boolean;
    expiresAt?: Date | null;
  } = {},
): Promise<License | undefined> {
  const old = (await chainFrom(deps, lid)).at(-1);
  if (!old) return undefined;

  const now = deps.now?.() ?? new Date();
  const expiresAt =
    opts.expiresAt !== undefined
      ? opts.expiresAt
      : old.expiresAt && new Date(now.getTime() + (old.expiresAt.getTime() - old.issuedAt.getTime()));
  const attestationRequired = opts.kind === 'renewal' || (old.attestationRequired && !old.attestedAt);
  const created = await issueLicense(deps, old.email, old.updatesOptIn || opts.updatesOptIn === true, expiresAt, {
    attestationRequired,
  });
  // Point the application (if any) at the new lid so its key page links the signed copy.
  const [app] = await deps.db
    .select({ id: betaApplications.id })
    .from(betaApplications)
    .where(eq(betaApplications.lid, old.lid))
    .limit(1);
  try {
    await sendKeyLink(deps, created, opts.kind ?? 'reissue', app?.id ?? null);
  } catch (err) {
    await deps.db.delete(keyLinks).where(eq(keyLinks.lid, created.lid));
    await deps.db.delete(licenses).where(eq(licenses.lid, created.lid));
    throw err;
  }
  if (app) await deps.db.update(betaApplications).set({ lid: created.lid }).where(eq(betaApplications.id, app.id));
  await deps.db
    .update(licenses)
    .set({
      replacedBy: created.lid,
      ...(opts.kind === 'renewal' ? { renewalSentAt: deps.now?.() ?? new Date() } : {}),
      ...(opts.revokeOld && !old.revokedAt
        ? { revokedAt: deps.now?.() ?? new Date(), revokedReason: opts.reason ?? 'reissued', revokedBy: opts.by ?? null }
        : {}),
    })
    .where(eq(licenses.lid, old.lid));
  return created;
}

/** Daily: email a key link for a fresh license to everyone whose license ends within the renewal window. Non-expiring licenses are never due. */
export async function runRenewals(deps: Deps, limit = 200): Promise<{ renewed: number; failed: string[] }> {
  const now = deps.now?.() ?? new Date();
  const due = await deps.db
    .select({ lid: licenses.lid })
    .from(licenses)
    .where(
      and(
        isNull(licenses.revokedAt),
        isNull(licenses.replacedBy),
        isNull(licenses.renewalSentAt),
        gt(licenses.expiresAt, now),
        lte(licenses.expiresAt, new Date(now.getTime() + RENEWAL_WINDOW_DAYS * DAY_MS)),
      ),
    )
    .orderBy(asc(licenses.expiresAt))
    .limit(limit);

  const failed: string[] = [];
  for (const { lid } of due) {
    try {
      await reissueLicense(deps, lid, { kind: 'renewal' });
    } catch {
      failed.push(lid);
    }
  }
  return { renewed: due.length - failed.length, failed };
}

/**
 * The signed revocation list. iat is the current hour, so every request in an
 * hour gets the same bytes (Ed25519 is deterministic). Revoked licenses are
 * listed until they expire (expired ones are rejected anyway); revoked
 * non-expiring licenses stay listed for good.
 */
export async function buildRevocationList(deps: Pick<Deps, 'db' | 'key' | 'now'>): Promise<string> {
  const now = deps.now?.() ?? new Date();
  const iat = Math.floor(toUnix(now) / HOUR_S) * HOUR_S;
  const rows = await deps.db
    .select({ lid: licenses.lid })
    .from(licenses)
    .where(and(isNotNull(licenses.revokedAt), unexpired(now)))
    .orderBy(asc(licenses.lid));
  return signRevocations(
    { v: 1, kid: deps.key.kid, iat, next: iat + HOUR_S, revoked: rows.map((r) => r.lid) },
    deps.key,
  );
}
