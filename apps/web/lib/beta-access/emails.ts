// Beta access emails. Same style as lib/licensing/email.ts: plain text first,
// the HTML part mirrors it. No email carries a license key or a PDF. Emails that carry
// a link or applicant answers are marked secret, so the email log never stores their content.
import { escapeHtml, type Mail } from '../licensing/email';
import type { BetaApplication, ConsentRecord, SignedDocument } from '../licensing/db/schema';
import { describeAnswers, type Answers } from './answers';

const longDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

const page = (body: string) =>
  `<!doctype html><html><body style="font-family:-apple-system,system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
${body}
<p>— Astrea Labs</p>
</body></html>`;

/** The link to confirm the address and sign. Sent on apply and on "resume signing". */
export function signLinkEmail(input: { url: string; expiresAt: Date; resume: boolean }): Omit<Mail, 'to'> {
  const intro = input.resume
    ? 'Here is a new link to sign your Aletheia beta application. Any earlier link no longer works.'
    : 'Thanks for applying for the Aletheia beta. To confirm this is your address, open the link below. You will then review and sign your application.';
  const note = `The link works once and expires on ${longDate(input.expiresAt)}. If you didn't apply, ignore this email.`;
  const text = [intro, '', input.url, '', note, '', '— Astrea Labs'].join('\n');
  const html = page(`<p>${escapeHtml(intro)}</p>
<p><a href="${escapeHtml(input.url)}">Review and sign my application</a></p>
<p>${escapeHtml(note)}</p>`);
  return { subject: 'Confirm your email to sign your Aletheia beta application', text, html, secret: true };
}

/** Sent to the applicant once the signed application is stored. */
export function receivedEmail(): Omit<Mail, 'to'> {
  const intro =
    "We've received your signed application for the Aletheia beta. We review each application by hand and will email you when we've decided.";
  const note = 'Submitting an application does not guarantee a license.';
  const text = [intro, '', note, '', '— Astrea Labs'].join('\n');
  const html = page(`<p>${escapeHtml(intro)}</p>
<p>${escapeHtml(note)}</p>`);
  return { subject: 'We received your Aletheia beta application', text, html, secret: true };
}

/** Where applicants send questions about their application record. */
export const SUPPORT_EMAIL = 'support@astrealabs.com';

/** A short, neutral decline, with when to reapply and what we keep. */
export function declineEmail(input: { reapplyAfter: Date }): Omit<Mail, 'to'> {
  const intro =
    "Thank you for applying for the Aletheia beta. We aren't able to offer you a place in the beta at this time.";
  const reapply = `You can apply again from ${longDate(input.reapplyAfter)}.`;
  const kept =
    'We keep your signed application and our decision for six years, as the record of what you were told and agreed to and of our review. We use it only for that and to check any later application from you.';
  const questions = `Questions about your record: ${SUPPORT_EMAIL}.`;
  const text = [intro, '', reapply, '', kept, '', questions, '', '— Astrea Labs'].join('\n');
  const html = page(`<p>${escapeHtml(intro)}</p>
<p>${escapeHtml(reapply)}</p>
<p>${escapeHtml(kept)}</p>
<p>Questions about your record: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`);
  return { subject: 'Your Aletheia beta application', text, html, secret: true };
}

/**
 * The review email to BETA_REVIEW_EMAIL: every answer and consent, plus the
 * link to approve or decline in the admin page. No PDF attached; the signed copy
 * stays in Blob and is reachable from that page.
 */
export function reviewEmail(input: {
  application: BetaApplication;
  document: SignedDocument;
  siteUrl: string;
}): Omit<Mail, 'to'> {
  const { application: app, document: doc } = input;
  const answers = describeAnswers(app.answers as Answers);
  // The ticked boxes: B0 and C1..C12.
  const consents = doc.blocks.filter((b: ConsentRecord) => b.tickedAt && (b.id === 'B0' || b.id.startsWith('C')));
  const facts: [string, string][] = [
    ['Application', app.id],
    ['Signed document', doc.id],
    ['Document version', `${doc.docType} ${doc.docVersion}`],
    ['Email confirmed', doc.emailConfirmedAt.toISOString()],
    ['Signed', doc.signedAt.toISOString()],
    ['Typed signature', doc.typedSignature],
    ['Signed PDF SHA-256', doc.pdfSha256],
    ['Seal', `${doc.sealAlg} ${doc.sealKeyId}`],
  ];
  const answerLines = answers.map((a) => `${a.id}. ${a.label}: ${a.value || '(blank)'}`);
  const consentLines = consents.map((c) => `${c.id} ticked ${c.tickedAt}`);
  const reviewUrl = `${input.siteUrl}/admin/applications/${app.id}`;
  const how = `Review, approve or decline: ${reviewUrl}`;

  const text = [
    'A new Aletheia beta application is signed and waiting for review.',
    '',
    ...facts.map(([k, v]) => `${k}: ${v}`),
    '',
    'Answers',
    ...answerLines,
    '',
    'Consents',
    ...consentLines,
    '',
    how,
  ].join('\n');

  const row = (k: string, v: string) =>
    `<tr><th align="left" valign="top" style="padding:2px 12px 2px 0">${escapeHtml(k)}</th><td style="padding:2px 0">${escapeHtml(v)}</td></tr>`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,system-ui,sans-serif;line-height:1.5;color:#111;max-width:720px">
<p>A new Aletheia beta application is signed and waiting for review.</p>
<table style="border-collapse:collapse;font-size:14px">${facts.map(([k, v]) => row(k, v)).join('')}</table>
<h3>Answers</h3>
<table style="border-collapse:collapse;font-size:14px">${answers.map((a) => row(`${a.id}. ${a.label}`, a.value || '(blank)')).join('')}</table>
<h3>Consents</h3>
<table style="border-collapse:collapse;font-size:14px">${consents.map((c) => row(c.id, `ticked ${c.tickedAt}`)).join('')}</table>
<p>Review, approve or decline: <a href="${escapeHtml(reviewUrl)}">${escapeHtml(reviewUrl)}</a></p>
</body></html>`;

  // The subject carries no personal data: mail clients show it in notifications.
  return { subject: 'New Aletheia beta application to review', text, html, secret: true };
}
