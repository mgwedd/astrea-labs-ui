import { and, eq, inArray, or } from 'drizzle-orm';
import type { WebhookEventPayload } from 'resend';
import { campaignSends, emailSuppressions, type SendStatus } from './db/schema';
import type { Db } from './sends';

// Resend webhook events, after the signature check. Every write is safe to repeat:
// Resend retries deliveries and may send events out of order.

type Suppression = typeof emailSuppressions.$inferInsert;

// A status only moves forward: a late 'delivered' never overwrites 'bounced'.
const MOVES_FROM: Partial<Record<SendStatus, SendStatus[]>> = {
  delivered: ['queued', 'sent'],
  failed: ['queued', 'sent'],
  suppressed: ['queued', 'sent'],
  bounced: ['queued', 'sent', 'delivered'],
  complained: ['queued', 'sent', 'delivered'],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EventOutcome = 'updated' | 'ignored';

export async function handleResendEvent(db: Db, event: WebhookEventPayload, now = new Date()): Promise<EventOutcome> {
  let status: SendStatus;
  let error: string | null = null;
  let suppress: Omit<Suppression, 'email' | 'resendEmailId'> | null = null;

  switch (event.type) {
    case 'email.delivered':
      status = 'delivered';
      break;
    case 'email.failed':
      status = 'failed';
      error = event.data.failed?.reason ?? null;
      break;
    case 'email.bounced': {
      status = 'bounced';
      const b = event.data.bounce;
      error = [b?.type, b?.subType, b?.message].filter(Boolean).join(': ') || null;
      // Only a permanent (hard) bounce stops future sends; a transient one is just logged.
      if (b?.type === 'Permanent') suppress = { reason: 'bounce', detail: error };
      break;
    }
    case 'email.complained':
      status = 'complained';
      suppress = { reason: 'complaint', detail: null };
      break;
    case 'email.suppressed':
      status = 'suppressed';
      error = event.data.suppressed?.message ?? null;
      suppress = { reason: 'resend_suppressed', detail: [event.data.suppressed?.type, error].filter(Boolean).join(': ') || null };
      break;
    default:
      return 'ignored';
  }

  const { email_id: resendEmailId, to, tags } = event.data;
  const recipients = to.map((e) => e.trim().toLowerCase());
  const campaignId = UUID.test(tags?.campaign ?? '') ? tags?.campaign : undefined;

  if (suppress) {
    await db
      .insert(emailSuppressions)
      .values(recipients.map((email) => ({ email, resendEmailId, ...suppress, createdAt: now })))
      .onConflictDoNothing();
  }

  // Find the row by Resend's id; fall back to campaign tag + address for rows sent without one.
  const match = campaignId
    ? or(eq(campaignSends.resendEmailId, resendEmailId), and(eq(campaignSends.campaignId, campaignId), inArray(campaignSends.email, recipients)))
    : eq(campaignSends.resendEmailId, resendEmailId);
  const updated = await db
    .update(campaignSends)
    .set({ status, ...(error ? { error: error.slice(0, 1000) } : {}), updatedAt: now })
    .where(and(match, inArray(campaignSends.status, MOVES_FROM[status] ?? [])))
    .returning({ id: campaignSends.id });

  return updated.length > 0 || suppress ? 'updated' : 'ignored';
}
