import 'server-only';
import { Resend } from 'resend';
import type { Mailer } from './email';

/**
 * Resend-backed mailer. Needs RESEND_API_KEY (from the Vercel Marketplace
 * integration) and LICENSE_EMAIL_FROM, e.g. "Astrea Labs <licenses@astrealabs.com>".
 */
export function resendMailer(): Mailer {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LICENSE_EMAIL_FROM;
  if (!apiKey && process.env.NODE_ENV === 'development') return consoleMailer();
  if (!apiKey || !from) throw new Error('RESEND_API_KEY and LICENSE_EMAIL_FROM must be set');
  const resend = new Resend(apiKey);
  return {
    async send(mail) {
      const { error } = await resend.emails.send({ from, ...mail });
      if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
    },
  };
}

/** Local development without Resend: print each email to the dev server log. */
function consoleMailer(): Mailer {
  return {
    async send(mail) {
      console.log(`\n--- license email (dev, not sent) ---\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n---\n`);
    },
  };
}
