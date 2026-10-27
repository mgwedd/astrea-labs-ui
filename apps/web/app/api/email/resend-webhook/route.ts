import { verifyWebhook } from '@/lib/email/campaigns';
import { handleResendEvent } from '@/lib/email/events';
import type { Db } from '@/lib/email/sends';
import { getDb } from '@/lib/licensing/db/client';

// Resend webhook: delivered, bounced, complained, failed and suppressed events update
// email_campaign_sends; hard bounces and complaints go to email_suppressions.
// Signed with RESEND_WEBHOOK_SECRET. Anything unsigned or badly signed gets a 400.

export async function POST(request: Request) {
  if (!process.env.RESEND_WEBHOOK_SECRET) {
    console.error('resend webhook: RESEND_WEBHOOK_SECRET is not set');
    return new Response('not configured', { status: 500 });
  }
  const payload = await request.text();
  let event;
  try {
    event = verifyWebhook(payload, request.headers);
  } catch {
    return new Response('invalid signature', { status: 400 });
  }
  try {
    await handleResendEvent(getDb() as unknown as Db, event);
  } catch (e) {
    // A 5xx makes Resend retry the delivery later.
    console.error('resend webhook: handling failed', event.type, e);
    return new Response('failed', { status: 500 });
  }
  return new Response(null, { status: 204 });
}
