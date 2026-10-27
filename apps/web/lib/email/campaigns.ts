import 'server-only';
import { Resend, type WebhookEventPayload } from 'resend';
import { fillPlaceholders, unsubscribeHeaders } from './html';
import { signUnsubscribeToken } from './token';

// The only module that talks to Resend. Mock it in tests. Resend only delivers: Postgres
// picks the recipients (lib/email/sends.ts) and each email carries our own signed
// unsubscribe link and one-click headers. No Resend contacts, segments, topics or Broadcasts.
// Env: RESEND_API_KEY, EMAIL_CAMPAIGN_FROM, EMAIL_UNSUBSCRIBE_SECRET, RESEND_WEBHOOK_SECRET.

/** Resend's batch endpoint takes at most 100 emails per request. */
export const BATCH_LIMIT = 100;

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY must be set');
  return new Resend(key);
}

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set`);
  return v;
}

/** Send one rendered email to a single address (the signed-in admin) with working unsubscribe links and headers. */
export async function sendTestEmail(args: { to: string; subject: string; html: string; siteUrl: string }): Promise<Result> {
  try {
    const token = signUnsubscribeToken(args.to);
    const { error } = await client().emails.send({
      from: need('EMAIL_CAMPAIGN_FROM'),
      to: args.to,
      subject: `[Test] ${args.subject}`,
      html: fillPlaceholders(args.html, token),
      headers: unsubscribeHeaders(args.siteUrl, token),
    });
    return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export type OutgoingEmail = { to: string; subject: string; html: string; headers: Record<string, string>; campaignId: string };

/** Per email, in input order: Resend's id, or why Resend refused it. The id is null if Resend accepted it but its reply didn't line up. */
export type BatchOutcome = { id: string | null } | { error: string };

/**
 * Send up to BATCH_LIMIT emails in one request. Permissive validation, so one bad
 * address fails alone. `ok: false` means the whole request failed and nothing was sent.
 */
export async function sendBatch(emails: OutgoingEmail[], idempotencyKey: string): Promise<Result<BatchOutcome[]>> {
  if (emails.length === 0) return { ok: true, data: [] };
  if (emails.length > BATCH_LIMIT) return { ok: false, error: `At most ${BATCH_LIMIT} emails per batch` };
  try {
    const from = need('EMAIL_CAMPAIGN_FROM');
    const { data, error } = await client().batch.send(
      emails.map((e) => ({ from, to: e.to, subject: e.subject, html: e.html, headers: e.headers, tags: [{ name: 'campaign', value: e.campaignId }] })),
      { batchValidation: 'permissive', idempotencyKey },
    );
    if (error || !data) return { ok: false, error: error?.message ?? 'No reply from Resend' };
    const refused = new Map((data.errors ?? []).map((e) => [e.index, e.message]));
    const ids = data.data.map((d) => d.id);
    // Accepted emails come back in order, without the refused ones. If the counts don't match,
    // keep the ids out rather than pin one to the wrong row; webhooks fall back to the campaign tag.
    const aligned = ids.length === emails.length - refused.size;
    if (!aligned) console.error('email batch: Resend returned', ids.length, 'ids for', emails.length - refused.size, 'accepted emails');
    let next = 0;
    return {
      ok: true,
      data: emails.map((_, i): BatchOutcome => {
        const message = refused.get(i);
        if (message !== undefined) return { error: message };
        return { id: aligned ? ids[next++] : null };
      }),
    };
  } catch (e) {
    return fail(e);
  }
}

/** Check a Resend webhook's signature against the raw body. Throws on a bad or missing signature. */
export function verifyWebhook(payload: string, headers: Headers): WebhookEventPayload {
  const id = headers.get('svix-id') ?? headers.get('webhook-id');
  const timestamp = headers.get('svix-timestamp') ?? headers.get('webhook-timestamp');
  const signature = headers.get('svix-signature') ?? headers.get('webhook-signature');
  if (!id || !timestamp || !signature) throw new Error('Missing webhook signature headers');
  // verify() runs locally (no API call); the client only needs some key to be constructed.
  return new Resend(process.env.RESEND_API_KEY || 'unused').webhooks.verify({
    payload,
    headers: { id, timestamp, signature },
    webhookSecret: need('RESEND_WEBHOOK_SECRET'),
  });
}
