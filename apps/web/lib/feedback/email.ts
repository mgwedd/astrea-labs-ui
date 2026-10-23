import type { Mail } from '@/lib/licensing/email';
import { getFeedbackProject } from './projects';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function confirmationEmail(input: { confirmUrl: string; projectSlug: string; title: string; type: 'bug' | 'feature' }): Omit<Mail, 'to'> {
  const project = getFeedbackProject(input.projectSlug)?.name ?? input.projectSlug;
  const kind = input.type === 'bug' ? 'bug report' : 'feature request';
  const text = [
    `Confirm your ${kind} for ${project}:`,
    '',
    `"${input.title}"`,
    '',
    'Open this link and press the button to confirm. We review every report before anything is posted publicly:',
    input.confirmUrl,
    '',
    'The link works once and expires in 24 hours. Your email address is never posted. If you did not submit this, ignore this email and nothing will be posted.',
    '',
    '— Astrea Labs',
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:-apple-system,system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
<p>Confirm your ${kind} for <strong>${escapeHtml(project)}</strong>:</p>
<blockquote style="margin:0;padding-left:12px;border-left:3px solid #ddd">${escapeHtml(input.title)}</blockquote>
<p><a href="${escapeHtml(input.confirmUrl)}">Review and confirm</a> and press the button to confirm. We review every report before anything is posted publicly.</p>
<p style="color:#555;font-size:13px">The link works once and expires in 24 hours. Your email address is never posted. If you did not submit this, ignore this email and nothing will be posted.</p>
<p>— Astrea Labs</p>
</body></html>`;
  return { subject: `Confirm your ${kind} for ${project}`, text, html };
}
