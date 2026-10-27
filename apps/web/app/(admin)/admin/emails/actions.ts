'use server';

// Server actions for /admin/emails. Each one calls requireAdmin() first (actions are
// reachable by POST on their own) and redirects with ?notice=<key> (see lib/admin/format.ts).

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/gate';
import type { NoticeKey } from '@/lib/admin/format';
import { parseAudience } from '@/lib/email/audience';
import { sendBatch, sendTestEmail } from '@/lib/email/campaigns';
import { buildEmailHtml, fillPlaceholders, MAX_CAMPAIGN_HTML, sanitizeCampaignHtml } from '@/lib/email/html';
import { sendCampaign as deliverCampaign, type Db } from '@/lib/email/sends';
import { signUnsubscribeToken } from '@/lib/email/token';
import { siteUrlFor } from '@/lib/licensing/server';
import { getDb } from '@/lib/licensing/db/client';

const PATH = '/admin/emails';

const back = (notice: NoticeKey): never => {
  revalidatePath(PATH);
  redirect(`${PATH}?notice=${notice}`);
};

const Html = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CAMPAIGN_HTML)
  .refine((v) => sanitizeCampaignHtml(v).trim() !== '', 'nothing left after sanitizing');

const Compose = z.object({
  subject: z.string().trim().min(1).max(200),
  html: Html,
  audience: z.string().transform((v, ctx) => parseAudience(v) ?? (ctx.addIssue({ code: 'custom', message: 'unknown audience' }), z.NEVER)),
});

const parse = (form: FormData) => Compose.safeParse(Object.fromEntries(form.entries()));

export type PreviewState = { html: string } | { error: string } | null;

/** The email as it will be sent (sanitized, with the unsubscribe footer) and the per-recipient links filled with stand-ins. Needs only the HTML. */
export async function previewCampaign(_prev: PreviewState, form: FormData): Promise<PreviewState> {
  await requireAdmin();
  const p = z.object({ html: Html }).safeParse({ html: form.get('html') });
  if (!p.success) return { error: 'Add some HTML to preview. Scripts, forms and styles blocks are removed.' };
  const html = fillPlaceholders(buildEmailHtml(p.data.html, siteUrlFor()), 'preview');
  return { html };
}

/** Sends to the signed-in admin only. */
export async function sendTestCampaign(form: FormData) {
  const admin = await requireAdmin();
  const p = parse(form);
  if (!p.success) return back('invalid');
  const siteUrl = siteUrlFor();
  const r = await sendTestEmail({ to: admin.email, subject: p.data.subject, html: buildEmailHtml(p.data.html, siteUrl), siteUrl });
  if (!r.ok) console.error('campaign test send failed', r.error);
  return back(r.ok ? 'test_sent' : 'test_failed');
}

const CAMPAIGN_NOTICE = { sent: 'campaign_sent', partial: 'campaign_partial', failed: 'campaign_failed', no_recipients: 'campaign_empty' } as const;

/** Sends to everyone opted in to the audience who isn't suppressed, recording each recipient. */
export async function sendCampaign(form: FormData) {
  const admin = await requireAdmin();
  const p = parse(form);
  if (!p.success) return back('invalid');
  const { subject, html, audience } = p.data;
  const siteUrl = siteUrlFor();
  let notice: NoticeKey;
  try {
    const r = await deliverCampaign(
      { db: getDb() as unknown as Db, siteUrl, sendBatch, sign: signUnsubscribeToken },
      { audience, subject, html: buildEmailHtml(html, siteUrl), bodyHtml: sanitizeCampaignHtml(html), sentBy: admin.email },
    );
    notice = CAMPAIGN_NOTICE[r.status];
  } catch (e) {
    console.error('campaign send failed', e);
    notice = 'campaign_failed';
  }
  return back(notice);
}
