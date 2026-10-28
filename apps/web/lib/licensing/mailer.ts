import 'server-only';
import { Resend } from 'resend';
import { recordedMailer, type Sender } from '@/lib/email/outbox';
import { getDb } from './db/client';
import type { Mailer } from './email';

const SEND_TIMEOUT_MS = 10_000;

/**
 * Resend-backed mailer. Needs RESEND_API_KEY (from the Vercel Marketplace
 * integration) and LICENSE_EMAIL_FROM, e.g. "Astrea Labs <licenses@astrealabs.com>".
 * Every send is recorded in email_outbox; failures queue there for an admin.
 */
export function resendMailer(): Mailer {
  if (!process.env.RESEND_API_KEY && process.env.NODE_ENV === 'development') return consoleMailer();
  return recordedMailer(resendSender(), getDb);
}

/** The raw Resend send. Missing settings fail the send (so it is recorded and queued), not the caller's setup. */
export function resendSender(): Sender {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LICENSE_EMAIL_FROM;
  const resend = apiKey ? new Resend(apiKey) : null;
  return async (mail) => {
    if (!resend || !from) throw new Error('RESEND_API_KEY and LICENSE_EMAIL_FROM must be set');
    // Bound provider latency so approvals and recovery requests can record a failure.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const { data, error } = await resend.emails.send(
        {
          from,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          attachments: mail.attachments?.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content),
          })),
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) throw new Error('Resend: email send timed out after 10 seconds');
      if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
      if (!data?.id) throw new Error('Resend: email send returned no message id');
      return data.id;
    } finally {
      clearTimeout(timeout);
    }
  };
}

/** Local development without Resend: print each email to the dev server log. */
function consoleMailer(): Mailer {
  return {
    async send(mail) {
      const files = mail.attachments?.map((a) => `${a.filename} (${a.content.byteLength} bytes)`).join(', ');
      console.log(
        `\n--- license email (dev, not sent) ---\nTo: ${mail.to}\nSubject: ${mail.subject}\n${files ? `Attachments: ${files}\n` : ''}\n${mail.text}\n---\n`,
      );
    },
  };
}
