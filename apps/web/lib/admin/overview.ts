import 'server-only';
import { and, asc, count, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { emailOutbox } from '@/lib/email/db/schema';
import { feedbackSubmissions } from '@/lib/feedback/db/schema';
import { forumCategories, forumThreads } from '@/lib/forum/db/schema';
import { ACTIVE_STATUSES, type ReportStatus, type ThreadKind } from '@/lib/forum/reports';
import { betaApplications, licenses, testLicenses } from '@/lib/licensing/db/schema';
import type { Db } from '@/lib/licensing/service';

// Read-only queries for the admin Overview and the sidebar badges.

const DAY = 86_400_000;
export const EXPIRY_WINDOW_DAYS = 30;
const LIST_LIMIT = 5;

type Deps = { db: Db; now?: () => Date };

export type QueueItem = {
  kind: 'application' | 'feedback' | 'license' | 'email';
  id: string;
  title: string;
  meta: string;
  href: string;
  at: Date;
  flagged: boolean;
};

export type Overview = {
  applicationsToReview: number;
  feedbackToReview: number;
  feedbackFlagged: number;
  emailsFailed: number;
  activeLicenses: number;
  licensesExpiringSoon: number;
  liveTestLicenses: number;
  queue: QueueItem[];
  openReports: number;
  forumActivity: { id: string; title: string; kind: ThreadKind; status: ReportStatus | null; category: string; replyCount: number; at: Date }[];
};

const activeLicense = (now: Date) =>
  and(isNull(licenses.revokedAt), isNull(licenses.replacedBy), or(isNull(licenses.expiresAt), gt(licenses.expiresAt, now)));

/** Counts for the sidebar badges. */
export async function getNavCounts({ db }: Deps): Promise<{ applications: number; feedback: number; emails: number }> {
  const [[a], [f], [e]] = await Promise.all([
    db.select({ n: count() }).from(betaApplications).where(eq(betaApplications.status, 'submitted')),
    db.select({ n: count() }).from(feedbackSubmissions).where(eq(feedbackSubmissions.status, 'pending_review')),
    db.select({ n: count() }).from(emailOutbox).where(eq(emailOutbox.status, 'failed')),
  ]);
  return { applications: a?.n ?? 0, feedback: f?.n ?? 0, emails: e?.n ?? 0 };
}

export async function getOverview(deps: Deps): Promise<Overview> {
  const { db } = deps;
  const now = deps.now?.() ?? new Date();
  const soon = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * DAY);

  const [[apps], [fb], [flagged], [active], [expiring], [liveTests], appRows, fbRows, expiringRows, [reports], [emailsFailed], failedRows, threadRows] = await Promise.all([
    db.select({ n: count() }).from(betaApplications).where(eq(betaApplications.status, 'submitted')),
    db.select({ n: count() }).from(feedbackSubmissions).where(eq(feedbackSubmissions.status, 'pending_review')),
    db
      .select({ n: count() })
      .from(feedbackSubmissions)
      .where(and(eq(feedbackSubmissions.status, 'pending_review'), eq(feedbackSubmissions.flagged, true))),
    db.select({ n: count() }).from(licenses).where(activeLicense(now)),
    db
      .select({ n: count() })
      .from(licenses)
      .where(and(activeLicense(now), lte(licenses.expiresAt, soon))),
    db
      .select({ n: count() })
      .from(testLicenses)
      .where(and(isNull(testLicenses.revokedAt), gt(testLicenses.expiresAt, now))),
    db
      .select({
        id: betaApplications.id,
        email: betaApplications.email,
        createdAt: betaApplications.createdAt,
      })
      .from(betaApplications)
      .where(eq(betaApplications.status, 'submitted'))
      .orderBy(asc(betaApplications.createdAt))
      .limit(LIST_LIMIT),
    db
      .select({
        id: feedbackSubmissions.id,
        title: feedbackSubmissions.title,
        type: feedbackSubmissions.type,
        projectSlug: feedbackSubmissions.projectSlug,
        flagged: feedbackSubmissions.flagged,
        flagReason: feedbackSubmissions.flagReason,
        at: sql<Date>`coalesce(${feedbackSubmissions.confirmedAt}, ${feedbackSubmissions.createdAt})`.mapWith(
          (v: string | Date) => new Date(v),
        ),
      })
      .from(feedbackSubmissions)
      .where(eq(feedbackSubmissions.status, 'pending_review'))
      .orderBy(desc(feedbackSubmissions.flagged), asc(feedbackSubmissions.createdAt))
      .limit(LIST_LIMIT),
    db
      .select({ lid: licenses.lid, email: licenses.email, tier: licenses.tier, expiresAt: licenses.expiresAt })
      .from(licenses)
      .where(and(activeLicense(now), lte(licenses.expiresAt, soon)))
      .orderBy(asc(licenses.expiresAt))
      .limit(LIST_LIMIT),
    db
      .select({ n: count() })
      .from(forumThreads)
      .where(and(inArray(forumThreads.kind, ['bug', 'feature']), inArray(forumThreads.status, [...ACTIVE_STATUSES]), isNull(forumThreads.archivedAt))),
    db.select({ n: count() }).from(emailOutbox).where(eq(emailOutbox.status, 'failed')),
    db
      .select({ id: emailOutbox.id, to: emailOutbox.to, subject: emailOutbox.subject, error: emailOutbox.error, at: emailOutbox.lastAttemptAt })
      .from(emailOutbox)
      .where(eq(emailOutbox.status, 'failed'))
      .orderBy(asc(emailOutbox.lastAttemptAt))
      .limit(LIST_LIMIT),
    db
      .select({
        id: forumThreads.id,
        title: forumThreads.title,
        kind: forumThreads.kind,
        status: forumThreads.status,
        category: forumCategories.name,
        replyCount: forumThreads.replyCount,
        at: forumThreads.lastActivityAt,
      })
      .from(forumThreads)
      .innerJoin(forumCategories, eq(forumCategories.id, forumThreads.categoryId))
      .where(isNull(forumThreads.archivedAt))
      .orderBy(desc(forumThreads.lastActivityAt))
      .limit(LIST_LIMIT),
  ]);

  const queue: QueueItem[] = [
    ...failedRows.map((r): QueueItem => ({
      kind: 'email',
      id: r.id,
      title: r.to,
      meta: `Not sent: ${r.subject}`,
      href: '/admin/emails',
      at: r.at,
      flagged: true,
    })),
    ...fbRows.map((r): QueueItem => ({
      kind: 'feedback',
      id: r.id,
      title: r.title,
      meta: `${r.type === 'bug' ? 'Bug' : 'Feature'} · ${r.projectSlug}${r.flagged ? ` · flagged${r.flagReason ? `: ${r.flagReason}` : ''}` : ''}`,
      href: `/admin/feedback/${r.id}`,
      at: r.at,
      flagged: r.flagged,
    })),
    ...appRows.map((r): QueueItem => ({
      kind: 'application',
      id: r.id,
      title: r.email,
      meta: 'Beta application',
      href: `/admin/applications/${r.id}`,
      at: r.createdAt,
      flagged: false,
    })),
    ...expiringRows.map((r): QueueItem => ({
      kind: 'license',
      id: r.lid,
      title: r.email,
      meta: `${r.tier} license expiring`,
      href: `/admin/licenses?q=${encodeURIComponent(r.email)}`,
      at: r.expiresAt as Date, // non-null: the query only matches rows with expiresAt <= soon
      flagged: false,
    })),
  ].sort((a, b) => Number(b.flagged) - Number(a.flagged) || a.at.getTime() - b.at.getTime());

  return {
    applicationsToReview: apps?.n ?? 0,
    feedbackToReview: fb?.n ?? 0,
    emailsFailed: emailsFailed?.n ?? 0,
    feedbackFlagged: flagged?.n ?? 0,
    activeLicenses: active?.n ?? 0,
    licensesExpiringSoon: expiring?.n ?? 0,
    liveTestLicenses: liveTests?.n ?? 0,
    queue,
    openReports: reports?.n ?? 0,
    forumActivity: threadRows,
  };
}
