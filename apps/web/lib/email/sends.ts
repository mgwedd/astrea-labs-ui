import { and, arrayContains, asc, eq, inArray, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { Audience } from './audience';
import { BATCH_LIMIT, type BatchOutcome, type OutgoingEmail, type Result } from './campaigns';
import * as schema from './db/schema';
import { campaignSends, emailCampaigns, emailPreferences, emailSuppressions, type EmailCampaign } from './db/schema';
import { fillPlaceholders, unsubscribeHeaders } from './html';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type SendDeps = {
  db: Db;
  siteUrl: string;
  sendBatch: (emails: OutgoingEmail[], idempotencyKey: string) => Promise<Result<BatchOutcome[]>>;
  sign: (email: string) => string;
  now?: () => Date;
};

const nowOf = (deps: { now?: () => Date }) => deps.now?.() ?? new Date();

// Rows per INSERT when queueing recipients, well under Postgres' bind-parameter limit.
const INSERT_CHUNK = 1000;

function audienceFilter(audience: Audience): SQL | undefined {
  if (audience === 'news') return isNotNull(emailPreferences.newsOptInAt);
  const slug = audience.slice('product:'.length);
  return and(isNotNull(emailPreferences.productOptInAt), arrayContains(emailPreferences.productSlugs, [slug]));
}

/** Everyone opted in to the audience, minus suppressed addresses, each address once. */
export async function selectRecipients(db: Db, audience: Audience): Promise<string[]> {
  const rows = await db
    .selectDistinct({ email: emailPreferences.email })
    .from(emailPreferences)
    .leftJoin(emailSuppressions, eq(emailSuppressions.email, emailPreferences.email))
    .where(and(isNull(emailSuppressions.email), audienceFilter(audience)))
    .orderBy(asc(emailPreferences.email));
  return rows.map((r) => r.email);
}

export type CampaignInput = {
  audience: Audience;
  subject: string;
  /** The full email with the token placeholder (buildEmailHtml). */
  html: string;
  /** The sanitized body without the footer, stored on the campaign row. */
  bodyHtml: string;
  sentBy: string;
};

export type CampaignOutcome =
  | { status: 'no_recipients' }
  | { status: Exclude<EmailCampaign['status'], 'sending'>; campaignId: string; recipients: number; failed: number };

/**
 * Record the campaign, queue one row per recipient, then send the queued rows in
 * batches of BATCH_LIMIT, one request at a time (well under Resend's rate limit).
 * Each row ends 'sent' with Resend's id, or 'failed' with the reason.
 */
export async function sendCampaign(deps: SendDeps, input: CampaignInput): Promise<CampaignOutcome> {
  const recipients = await selectRecipients(deps.db, input.audience);
  if (recipients.length === 0) return { status: 'no_recipients' };

  const [campaign] = await deps.db
    .insert(emailCampaigns)
    .values({ subject: input.subject, audience: input.audience, sentBy: input.sentBy, sentAt: nowOf(deps), bodyHtml: input.bodyHtml, status: 'sending' })
    .returning({ id: emailCampaigns.id });

  for (let i = 0; i < recipients.length; i += INSERT_CHUNK) {
    const chunk = recipients.slice(i, i + INSERT_CHUNK);
    await deps.db.insert(campaignSends).values(chunk.map((email) => ({ campaignId: campaign.id, email, status: 'queued' as const })));
  }

  await deliverQueued(deps, campaign.id, input);
  return finishCampaign(deps.db, campaign.id);
}

/** Send whatever is still queued for the campaign. Safe to call again: sent rows are never picked up twice. */
async function deliverQueued(deps: SendDeps, campaignId: string, input: Pick<CampaignInput, 'subject' | 'html'>) {
  for (;;) {
    const batch = await deps.db
      .select({ id: campaignSends.id, email: campaignSends.email })
      .from(campaignSends)
      .where(and(eq(campaignSends.campaignId, campaignId), eq(campaignSends.status, 'queued')))
      .orderBy(asc(campaignSends.email))
      .limit(BATCH_LIMIT);
    if (batch.length === 0) return;

    const emails = batch.map((r): OutgoingEmail => {
      const token = deps.sign(r.email);
      return { to: r.email, subject: input.subject, html: fillPlaceholders(input.html, token), headers: unsubscribeHeaders(deps.siteUrl, token), campaignId };
    });
    // The same rows give the same key, so a retried request can't send twice within Resend's 24h window.
    const r = await deps.sendBatch(emails, `campaign:${campaignId}:${batch[0].id}:${batch.length}`);
    const outcomes: BatchOutcome[] = r.ok ? r.data : batch.map(() => ({ error: r.error }));
    if (!r.ok) console.error('campaign batch failed', campaignId, r.error);
    await recordOutcomes(deps, batch.map((row, i) => ({ rowId: row.id, outcome: outcomes[i] ?? { error: 'No result from Resend' } })));
  }
}

async function recordOutcomes(deps: SendDeps, results: { rowId: string; outcome: BatchOutcome }[]) {
  const now = nowOf(deps);
  // One UPDATE per batch, not one per row.
  const values = sql.join(
    results.map(({ rowId, outcome }) =>
      'error' in outcome
        ? sql`(${rowId}::uuid, 'failed', ${null}::text, ${outcome.error.slice(0, 1000)}::text)`
        : sql`(${rowId}::uuid, 'sent', ${outcome.id}::text, ${null}::text)`,
    ),
    sql`, `,
  );
  await deps.db.execute(sql`
    update ${campaignSends} set
      status = v.status,
      resend_email_id = v.resend_email_id,
      error = v.error,
      updated_at = ${now}
    from (values ${values}) as v(id, status, resend_email_id, error)
    where ${campaignSends.id} = v.id and ${campaignSends.status} = 'queued'`);
}

async function finishCampaign(db: Db, campaignId: string): Promise<CampaignOutcome> {
  const counts = await db
    .select({ status: campaignSends.status, n: sql<number>`count(*)`.mapWith(Number) })
    .from(campaignSends)
    .where(eq(campaignSends.campaignId, campaignId))
    .groupBy(campaignSends.status);
  const recipients = counts.reduce((sum, c) => sum + c.n, 0);
  const failed = counts.find((c) => c.status === 'failed')?.n ?? 0;
  const status = failed === 0 ? 'sent' : failed === recipients ? 'failed' : 'partial';
  await db.update(emailCampaigns).set({ status }).where(eq(emailCampaigns.id, campaignId));
  return { status, campaignId, recipients, failed };
}

export type CampaignCounts = { recipients: number; failed: number; bounced: number; complained: number };

/** Per-campaign recipient counts for the admin list. Campaigns with no sends rows (old Broadcasts) are absent. */
export async function campaignCounts(db: Db, campaignIds: string[]): Promise<Map<string, CampaignCounts>> {
  const out = new Map<string, CampaignCounts>();
  if (campaignIds.length === 0) return out;
  const rows = await db
    .select({ campaignId: campaignSends.campaignId, status: campaignSends.status, n: sql<number>`count(*)`.mapWith(Number) })
    .from(campaignSends)
    .where(inArray(campaignSends.campaignId, campaignIds))
    .groupBy(campaignSends.campaignId, campaignSends.status);
  for (const r of rows) {
    const c = out.get(r.campaignId) ?? { recipients: 0, failed: 0, bounced: 0, complained: 0 };
    c.recipients += r.n;
    if (r.status === 'failed') c.failed += r.n;
    if (r.status === 'bounced') c.bounced += r.n;
    if (r.status === 'complained') c.complained += r.n;
    out.set(r.campaignId, c);
  }
  return out;
}
