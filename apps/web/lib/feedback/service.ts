// Feedback submissions: store unconfirmed, email a confirm link, on confirm hold
// for review, and only when a person approves create the GitHub issue exactly once.
// Dependencies are arguments so it runs the same on Neon and PGlite.
import { createHash, randomBytes } from 'node:crypto';
import { and, count, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { Mailer } from '@/lib/licensing/email';
import { confirmationEmail } from './email';
import { findFlags } from './flags';
import { createIssue, type IssueDraft } from './github';
import { issueBody, issueLabels, issueTitle } from './issue';
import { getFeedbackProject } from './projects';
import * as schema from './db/schema';
import { feedbackSubmissions, type FeedbackStatus, type FeedbackSubmission } from './db/schema';
import type { FeedbackContent, FeedbackInput } from './validation';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type DbDeps = { db: Db; now?: () => Date; createIssue?: typeof createIssue };
export type Deps = DbDeps & {
  mailer: Mailer;
  /** Origin for the confirm link, e.g. https://astrealabs.com */
  baseUrl: string;
};

export const RATE_LIMIT = { perHour: 3, perDay: 10 };
export const LINK_TTL_MS = 24 * 3_600_000;
export const PENDING_RETENTION_MS = 7 * 86_400_000;
/** A claimed-but-unfinished approve (crashed mid-request) may be retried after this long. */
const CLAIM_STALE_MS = 5 * 60_000;

const nowOf = (deps: DbDeps) => deps.now?.() ?? new Date();
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Deletes never-confirmed submissions older than 7 days. No cron: called on
 * every submit and confirm, which is enough for this volume.
 */
export async function purgeStaleUnconfirmed(deps: DbDeps): Promise<void> {
  await deps.db
    .delete(feedbackSubmissions)
    .where(
      and(
        eq(feedbackSubmissions.status, 'unconfirmed'),
        lt(feedbackSubmissions.createdAt, new Date(nowOf(deps).getTime() - PENDING_RETENTION_MS)),
      ),
    );
}

async function isRateLimited(deps: DbDeps, email: string): Promise<boolean> {
  const now = nowOf(deps).getTime();
  const [row] = await deps.db
    .select({
      hour: sql<number>`count(*) filter (where ${feedbackSubmissions.createdAt} >= ${new Date(now - 3_600_000)})`.mapWith(Number),
      day: count(),
    })
    .from(feedbackSubmissions)
    .where(and(eq(feedbackSubmissions.email, email), gt(feedbackSubmissions.createdAt, new Date(now - 86_400_000))));
  return row.hour >= RATE_LIMIT.perHour || row.day >= RATE_LIMIT.perDay;
}

export type SubmitOutcome = 'pending' | 'rate_limited';

export async function submitFeedback(deps: Deps, input: FeedbackInput): Promise<SubmitOutcome> {
  await purgeStaleUnconfirmed(deps);
  if (await isRateLimited(deps, input.email)) return 'rate_limited';

  const { email, project, type, title, ack: _ack, ...fields } = input;
  const flags = findFlags([title, ...Object.values(fields)]);
  const now = nowOf(deps);
  const token = randomBytes(32).toString('base64url');
  await deps.db.insert(feedbackSubmissions).values({
    tokenHash: hashToken(token),
    email,
    projectSlug: project,
    type,
    title,
    fields: fields as Record<string, string>,
    flagged: flags.length > 0,
    flagReason: flags.length ? flags.join('; ') : null,
    createdAt: now,
    expiresAt: new Date(now.getTime() + LINK_TTL_MS),
  });
  await deps.mailer.send({
    to: email,
    ...confirmationEmail({ confirmUrl: `${deps.baseUrl}/feedback/confirm?token=${token}`, projectSlug: project, title, type }),
  });
  return 'pending';
}

export type ConfirmResult = { status: 'received' | 'already' | 'invalid' | 'expired' };

/** The email link was used: move the submission into the review queue. Creates no issue. */
export async function confirmFeedback(deps: DbDeps, token: string): Promise<ConfirmResult> {
  await purgeStaleUnconfirmed(deps);
  const hash = hashToken(token);
  const now = nowOf(deps);
  const [claimed] = await deps.db
    .update(feedbackSubmissions)
    .set({ status: 'pending_review', confirmedAt: now })
    .where(and(eq(feedbackSubmissions.tokenHash, hash), eq(feedbackSubmissions.status, 'unconfirmed'), gt(feedbackSubmissions.expiresAt, now)))
    .returning({ id: feedbackSubmissions.id });
  if (claimed) return { status: 'received' };

  const [row] = await deps.db.select({ status: feedbackSubmissions.status }).from(feedbackSubmissions).where(eq(feedbackSubmissions.tokenHash, hash));
  if (!row) return { status: 'invalid' };
  return { status: row.status === 'unconfirmed' ? 'expired' : 'already' };
}

// ---- Admin: triage ----

export type PublicSubmission = Omit<FeedbackSubmission, 'tokenHash'>;
const strip = ({ tokenHash: _t, ...rest }: FeedbackSubmission): PublicSubmission => rest;

export type InboxFilter = { type?: 'bug' | 'feature'; project?: string };

export async function listSubmissions(deps: DbDeps, status?: FeedbackStatus, filter: InboxFilter = {}): Promise<PublicSubmission[]> {
  const rows = await deps.db
    .select()
    .from(feedbackSubmissions)
    .where(
      and(
        status ? eq(feedbackSubmissions.status, status) : undefined,
        filter.type ? eq(feedbackSubmissions.type, filter.type) : undefined,
        filter.project ? eq(feedbackSubmissions.projectSlug, filter.project) : undefined,
      ),
    )
    .orderBy(desc(feedbackSubmissions.createdAt))
    .limit(200);
  return rows.map(strip);
}

/** How many submissions are in each status, for the inbox tabs. */
export async function statusCounts(deps: DbDeps): Promise<Record<FeedbackStatus, number>> {
  const rows = await deps.db.select({ status: feedbackSubmissions.status, n: count() }).from(feedbackSubmissions).groupBy(feedbackSubmissions.status);
  const out: Record<FeedbackStatus, number> = { unconfirmed: 0, pending_review: 0, creating: 0, approved: 0, rejected: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export async function getSubmission(deps: DbDeps, id: string): Promise<(PublicSubmission & { draft: IssueDraft }) | undefined> {
  const [row] = await deps.db.select().from(feedbackSubmissions).where(eq(feedbackSubmissions.id, id));
  return row ? { ...strip(row), draft: draftFor(row) } : undefined;
}

/** The default issue for a submission. Kept apart so a triage-repo flow can reuse or replace it. */
export function draftFor(row: Pick<FeedbackSubmission, 'projectSlug' | 'type' | 'title' | 'fields'>): IssueDraft {
  const content = { project: row.projectSlug, type: row.type, title: row.title, ...row.fields } as FeedbackContent;
  return { title: issueTitle(content), body: issueBody(content), labels: issueLabels(content) };
}

export type ApproveResult =
  | { status: 'approved' | 'already'; issueUrl: string; issueNumber: number | null }
  | { status: 'not_found' | 'not_reviewable' | 'in_progress' | 'failed' };

/** Creates the public issue, once. `edits` replace the generated title/body/labels. */
export async function approveSubmission(deps: DbDeps, id: string, edits: Partial<IssueDraft> = {}): Promise<ApproveResult> {
  const now = nowOf(deps);
  // Conditional update: only one caller can move pending_review -> creating.
  const [claimed] = await deps.db
    .update(feedbackSubmissions)
    .set({ status: 'creating', reviewedAt: now })
    .where(
      and(
        eq(feedbackSubmissions.id, id),
        or(
          eq(feedbackSubmissions.status, 'pending_review'),
          and(eq(feedbackSubmissions.status, 'creating'), lt(feedbackSubmissions.reviewedAt, new Date(now.getTime() - CLAIM_STALE_MS))),
        ),
        isNull(feedbackSubmissions.issueUrl),
      ),
    )
    .returning();

  if (!claimed) {
    const [row] = await deps.db.select().from(feedbackSubmissions).where(eq(feedbackSubmissions.id, id));
    if (!row) return { status: 'not_found' };
    if (row.status === 'approved' && row.issueUrl) return { status: 'already', issueUrl: row.issueUrl, issueNumber: row.issueNumber };
    return { status: row.status === 'creating' ? 'in_progress' : 'not_reviewable' };
  }

  try {
    const project = getFeedbackProject(claimed.projectSlug);
    if (!project) throw new Error('unknown project');
    const draft = { ...draftFor(claimed), ...edits };
    const issue = await (deps.createIssue ?? createIssue)(project.repo, draft);
    await deps.db
      .update(feedbackSubmissions)
      .set({ status: 'approved', issueNumber: issue.number, issueUrl: issue.url, reviewedAt: nowOf(deps) })
      .where(eq(feedbackSubmissions.id, id));
    return { status: 'approved', issueUrl: issue.url, issueNumber: issue.number };
  } catch (err) {
    await deps.db.update(feedbackSubmissions).set({ status: 'pending_review', reviewedAt: null }).where(eq(feedbackSubmissions.id, id));
    console.error('feedback issue creation failed', err instanceof Error ? err.message : 'unknown error');
    return { status: 'failed' };
  }
}

export async function rejectSubmission(deps: DbDeps, id: string, note?: string): Promise<{ status: 'rejected' | 'not_found' | 'not_reviewable' }> {
  const [row] = await deps.db
    .update(feedbackSubmissions)
    .set({ status: 'rejected', reviewedAt: nowOf(deps), reviewNote: note ?? null })
    .where(and(eq(feedbackSubmissions.id, id), eq(feedbackSubmissions.status, 'pending_review')))
    .returning({ id: feedbackSubmissions.id });
  if (row) return { status: 'rejected' };
  const [exists] = await deps.db.select({ id: feedbackSubmissions.id }).from(feedbackSubmissions).where(eq(feedbackSubmissions.id, id));
  return { status: exists ? 'not_reviewable' : 'not_found' };
}
