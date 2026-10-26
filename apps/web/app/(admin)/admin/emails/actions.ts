'use server';

// Server actions for /admin/emails. Each one calls requireAdmin() first (actions are
// reachable by POST on their own) and redirects with ?notice=<key> (see lib/admin/format.ts).

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/gate';
import type { NoticeKey } from '@/lib/admin/format';
import { parseAudience } from '@/lib/email/audience';
import { sendBroadcast, sendTestEmail } from '@/lib/email/campaigns';
import { emailCampaigns } from '@/lib/email/db/schema';
import { buildEmailHtml, fillPlaceholders } from '@/lib/email/markdown';
import { siteUrlFor } from '@/lib/licensing/server';
import { getDb } from '@/lib/licensing/db/client';

const PATH = '/admin/emails';

const back = (notice: NoticeKey): never => {
  revalidatePath(PATH);
  redirect(`${PATH}?notice=${notice}`);
};

const Compose = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(100_000),
  audience: z.string().transform((v, ctx) => parseAudience(v) ?? (ctx.addIssue({ code: 'custom', message: 'unknown audience' }), z.NEVER)),
});

const parse = (form: FormData) => Compose.safeParse(Object.fromEntries(form.entries()));

export type PreviewState = { html: string } | { error: string } | null;

/** The email as it will be sent, with the per-recipient links filled with stand-ins. */
export async function previewCampaign(_prev: PreviewState, form: FormData): Promise<PreviewState> {
  await requireAdmin();
  const p = parse(form);
  if (!p.success) return { error: 'Add a subject, a body and an audience.' };
  const html = fillPlaceholders(buildEmailHtml(p.data.body, siteUrlFor()), { token: 'preview', preferencesUrl: '#' });
  return { html };
}

/** Sends to the signed-in admin only. */
export async function sendTestCampaign(form: FormData) {
  const admin = await requireAdmin();
  const p = parse(form);
  if (!p.success) return back('invalid');
  const siteUrl = siteUrlFor();
  const r = await sendTestEmail({ to: admin.email, subject: p.data.subject, html: buildEmailHtml(p.data.body, siteUrl), siteUrl });
  if (!r.ok) console.error('campaign test send failed', r.error);
  return back(r.ok ? 'test_sent' : 'test_failed');
}

/** Sends a Resend Broadcast to the chosen audience's topic, then records it. */
export async function sendCampaign(form: FormData) {
  const admin = await requireAdmin();
  const p = parse(form);
  if (!p.success) return back('invalid');
  const { subject, body, audience } = p.data;
  const r = await sendBroadcast({ audience, subject, html: buildEmailHtml(body, siteUrlFor()) });
  if (!r.ok) console.error('campaign send failed', r.error);
  try {
    await getDb().insert(emailCampaigns).values({
      subject,
      audience,
      sentBy: admin.email,
      broadcastId: r.ok ? r.data.id : null,
      status: r.ok ? 'sent' : 'failed',
    });
  } catch (e) {
    console.error('campaign log failed', e);
  }
  return back(r.ok ? 'campaign_sent' : 'campaign_failed');
}
