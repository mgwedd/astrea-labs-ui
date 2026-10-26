// An admin's email to the person who reported feedback, and the history of what was sent.
// Dependencies are arguments so it runs the same on Neon and PGlite.
import { asc, eq } from 'drizzle-orm';
import { escapeHtml } from '@/lib/licensing/email';
import { feedbackReplies, feedbackSubmissions, type FeedbackReply } from './db/schema';
import { getFeedbackProject } from './projects';
import type { Deps } from './service';

export const MAX_REPLY_LENGTH = 5000;

export type ReplyOutcome = 'sent' | 'not_found' | 'no_email' | 'send_failed';

/** The email the reporter gets. The address of the admin is never included. */
export function replyEmail(input: { projectSlug: string; title: string; body: string }) {
  const project = getFeedbackProject(input.projectSlug)?.name ?? input.projectSlug;
  const subject = `Re: ${input.title} (${project})`.slice(0, 200);
  const text = [input.body, '', '—', `Astrea Labs, about your feedback on ${project}: "${input.title}"`].join('\n');
  const html = `<!doctype html><html><body style="font-family:-apple-system,system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
<div style="white-space:pre-wrap">${escapeHtml(input.body)}</div>
<p style="color:#555;font-size:13px;border-top:1px solid #ddd;padding-top:8px">Astrea Labs, about your feedback on ${escapeHtml(project)}: &ldquo;${escapeHtml(input.title)}&rdquo;</p>
</body></html>`;
  return { subject, text, html };
}

/**
 * Emails the reporter, then records the message. Only a reporter who confirmed their
 * address (so the address is verified as theirs) and has an email on record can be written to.
 * Nothing is recorded when the mailer fails.
 */
export async function replyToReporter(deps: Deps, input: { submissionId: string; body: string; sentBy: string }): Promise<ReplyOutcome> {
  const [s] = await deps.db.select().from(feedbackSubmissions).where(eq(feedbackSubmissions.id, input.submissionId));
  if (!s) return 'not_found';
  if (!s.email.trim() || !s.confirmedAt) return 'no_email';
  try {
    await deps.mailer.send({ to: s.email, ...replyEmail({ projectSlug: s.projectSlug, title: s.title, body: input.body }) });
  } catch (err) {
    console.error('feedback reply email failed', err instanceof Error ? err.message : 'unknown error');
    return 'send_failed';
  }
  await deps.db.insert(feedbackReplies).values({ submissionId: s.id, body: input.body, sentBy: input.sentBy, sentAt: deps.now?.() ?? new Date() });
  return 'sent';
}

/** Oldest first, so the thread reads top to bottom. */
export async function listReplies(deps: Pick<Deps, 'db'>, submissionId: string): Promise<FeedbackReply[]> {
  return deps.db.select().from(feedbackReplies).where(eq(feedbackReplies.submissionId, submissionId)).orderBy(asc(feedbackReplies.sentAt));
}
