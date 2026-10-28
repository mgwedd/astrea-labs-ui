// License emails. Plain text first; the HTML part mirrors it.
// No email ever carries a license key: they carry a single-use link to the
// page that shows it (see keyLinkEmail).

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Carries a single-use link: if it fails, the outbox keeps no copy and it cannot be retried as written. */
  secret?: true;
  attachments?: { filename: string; content: Uint8Array }[];
};
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export type KeyLinkKind = 'issue' | 'key-link' | 'renewal' | 'reissue';

const SUBJECTS: Record<KeyLinkKind, string> = {
  issue: 'Your Aletheia beta license',
  'key-link': 'Your Aletheia beta license',
  reissue: 'Your new Aletheia beta license',
  renewal: 'Your Aletheia beta license, renewed',
};

const INTROS: Record<KeyLinkKind, string> = {
  issue: 'Your application for the Aletheia beta is approved. Open the link below to see your license key.',
  'key-link':
    'Here is a new link to your Aletheia license key. Open it below to see the key. If you didn’t ask for this, ignore this email: your license keeps working and nobody else can see the key.',
  reissue: 'We have issued you a new Aletheia license. Open the link below to see it, and use it from now on.',
  renewal:
    'Your Aletheia beta license ends soon. To renew it, open the link below and confirm that your professional license is still active and unrestricted. You will then see your renewed key: paste it into Aletheia in Settings → License key before the old one ends. If you don’t confirm, your current key ends on its usual date.',
};

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const longDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export const SUPPORT_EMAIL = 'support@astrealabs.com';

export function keyLinkEmail(input: {
  url: string;
  linkExpiresAt: Date;
  licenseExpiresAt: Date | null;
  downloadUrl: string;
  siteUrl: string;
  kind: KeyLinkKind;
  /** An account join link bound to the licensee's email. */
  inviteUrl?: string;
}): Omit<Mail, 'to'> {
  const linkNote = `The link works once and expires on ${longDate(input.linkExpiresAt)}. Don't forward this email.`;
  const validity = input.licenseExpiresAt
    ? `This license is valid until ${longDate(input.licenseExpiresAt)}. We will email you about acquiring an Early Availability license about 30 days before your Beta license expires.`
    : 'This license does not expire.';
  const support = `Reach out to ${SUPPORT_EMAIL} any time.`;
  const account =
    'Create an Astrea Labs account to report bugs, request features and talk with the developers on the forums. The account link works once and expires in 7 days.';
  const lost = `${input.siteUrl}/aletheia/beta`;
  const text = [
    INTROS[input.kind],
    '',
    input.url,
    '',
    linkNote,
    '',
    `Download Aletheia for macOS: ${input.downloadUrl}`,
    '',
    `${validity} ${support}`,
    '',
    ...(input.inviteUrl ? [account, '', input.inviteUrl, ''] : []),
    `Link expired or already used? Request a new one at ${lost}.`,
    '',
    '— Astrea Labs LLC',
  ].join('\n');

  const html = `<!doctype html><html><body style="font-family:-apple-system,system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
<p>${escapeHtml(INTROS[input.kind])}</p>
<p><a href="${escapeHtml(input.url)}">Show my license key</a></p>
<p>${escapeHtml(linkNote)}</p>
<p><a href="${escapeHtml(input.downloadUrl)}">Download Aletheia for macOS</a></p>
<p>${escapeHtml(validity)} Reach out to <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> any time.</p>
${input.inviteUrl ? `<p>${escapeHtml(account)}</p>\n<p><a href="${escapeHtml(input.inviteUrl)}">Create my account</a></p>\n` : ''}<p>Link expired or already used? <a href="${escapeHtml(lost)}">Request a new one</a>.</p>
<p>— Astrea Labs LLC</p>
</body></html>`;

  return { subject: SUBJECTS[input.kind], text, html, secret: true };
}
