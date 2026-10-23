// Simple accept: validate the ticks against the definition, then store one
// append-only evidence row. Signed agreements go through lib/agreements/signed.
// Dependencies are arguments so it runs the same on Neon and PGlite.
import { and, count, desc, eq, gt } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { requiredCheckboxIds, type AgreementDefinition } from './define';
import { agreementSha256, tickRecords } from './evidence';
import * as schema from './db/schema';
import { agreementAcceptances, type AgreementAcceptance } from './db/schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Deps = { db: Db; now?: () => Date };

/** Accepts per subject per agreement per hour. */
export const RATE_LIMIT_PER_HOUR = 10;
/** The page must have been shown within this long before accepting. */
export const SHOWN_MAX_AGE_MS = 24 * 3_600_000;
/** Allowed client clock skew on tick times. */
const SKEW_MS = 60_000;

export type AcceptInput = {
  definition: AgreementDefinition;
  /** The version the page showed; must equal the current one. */
  version: string;
  /** Lower-cased email or account id. */
  subject: string;
  /** True only when the caller proved who the subject is. */
  subjectVerified: boolean;
  /** When the terms were shown (ISO). */
  shownAt: string;
  /** Box id -> when it was ticked (ISO). Only ticked boxes. */
  tickedAt: Record<string, string>;
  /** The client's clock when it sent the request (ISO). Times are shifted by
   *  (server now - sentAt), so a wrong client clock doesn't block acceptance. */
  sentAt?: string;
  meta?: { ip: string | null; ua: string | null };
};

export type AcceptError = 'not_simple' | 'stale_version' | 'missing_required' | 'unknown_box' | 'bad_time' | 'rate_limited';
export type AcceptOutcome = { ok: true; id: string; acceptedAt: Date } | { ok: false; error: AcceptError };

const nowOf = (deps: Deps) => deps.now?.() ?? new Date();

export async function acceptAgreement(deps: Deps, input: AcceptInput): Promise<AcceptOutcome> {
  const def = input.definition;
  if (def.level !== 'accept') return { ok: false, error: 'not_simple' };
  if (input.version !== def.version) return { ok: false, error: 'stale_version' };

  const boxIds = new Set(def.checkboxes.map((b) => b.id));
  if (Object.keys(input.tickedAt).some((id) => !boxIds.has(id))) return { ok: false, error: 'unknown_box' };
  if (requiredCheckboxIds(def).some((id) => !Object.hasOwn(input.tickedAt, id))) {
    return { ok: false, error: 'missing_required' };
  }

  const now = nowOf(deps);
  const sent = input.sentAt === undefined ? now.getTime() : Date.parse(input.sentAt);
  if (!Number.isFinite(sent)) return { ok: false, error: 'bad_time' };
  const offset = now.getTime() - sent;
  const toServer = (iso: string) => Date.parse(iso) + offset;
  const shown = toServer(input.shownAt);
  if (!Number.isFinite(shown) || shown > now.getTime() + SKEW_MS || shown < now.getTime() - SHOWN_MAX_AGE_MS) {
    return { ok: false, error: 'bad_time' };
  }
  for (const at of Object.values(input.tickedAt)) {
    const t = toServer(at);
    if (!Number.isFinite(t) || t < shown - SKEW_MS || t > now.getTime() + SKEW_MS) return { ok: false, error: 'bad_time' };
  }

  const [recent] = await deps.db
    .select({ n: count() })
    .from(agreementAcceptances)
    .where(
      and(
        eq(agreementAcceptances.agreementId, def.id),
        eq(agreementAcceptances.subject, input.subject),
        gt(agreementAcceptances.acceptedAt, new Date(now.getTime() - 3_600_000)),
      ),
    );
  if ((recent?.n ?? 0) >= RATE_LIMIT_PER_HOUR) return { ok: false, error: 'rate_limited' };

  // Store tick times on the server clock, as ISO.
  const ticks = tickRecords(
    def,
    Object.fromEntries(Object.entries(input.tickedAt).map(([id, at]) => [id, new Date(toServer(at)).toISOString()])),
  );
  const [row] = await deps.db
    .insert(agreementAcceptances)
    .values({
      agreementId: def.id,
      version: def.version,
      sha256: agreementSha256(def),
      subject: input.subject,
      subjectVerified: input.subjectVerified,
      ticks,
      shownAt: new Date(shown),
      acceptedAt: now,
      ip: input.meta?.ip ?? null,
      userAgent: input.meta?.ua ?? null,
    })
    .returning({ id: agreementAcceptances.id });
  return { ok: true, id: row!.id, acceptedAt: now };
}

/** The subject's latest acceptance of the agreement's current version, if any.
 *  Only rows with a proven subject count unless `includeUnverified` is set:
 *  anyone can type someone else's email on the public page. */
export async function currentAcceptance(
  deps: Deps,
  def: AgreementDefinition,
  subject: string,
  opts: { includeUnverified?: boolean } = {},
): Promise<AgreementAcceptance | undefined> {
  const [row] = await deps.db
    .select()
    .from(agreementAcceptances)
    .where(
      and(
        eq(agreementAcceptances.agreementId, def.id),
        eq(agreementAcceptances.version, def.version),
        eq(agreementAcceptances.subject, subject),
        opts.includeUnverified ? undefined : eq(agreementAcceptances.subjectVerified, true),
      ),
    )
    .orderBy(desc(agreementAcceptances.acceptedAt))
    .limit(1);
  return row;
}
