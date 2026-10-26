import 'server-only';
import { Resend } from 'resend';
import { projects } from '@astrea/research-registry';
import { topicEnvName, type Audience } from './audience';
import { fillPlaceholders } from './html';
import { signUnsubscribeToken } from './token';

// The only module that talks to Resend. Mock it in tests.
//   Contacts + Topics: one topic per audience; a contact opts in or out of each.
//   Segment: one segment holds every contact (Broadcasts need a segment); the topic does the filtering.
//   Broadcasts: created with { segmentId, topicId, send: true }, so only contacts opted in to the topic get it.
// Env: RESEND_API_KEY, RESEND_SEGMENT_ID, RESEND_TOPIC_NEWS, RESEND_TOPIC_PRODUCT_<SLUG>,
// EMAIL_CAMPAIGN_FROM, EMAIL_UNSUBSCRIBE_SECRET. Contact property `unsubscribe_token` (string) must exist.

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

const topicId = (a: Audience) => need(topicEnvName(a));

export type ContactState = { email: string; product: boolean; news: boolean; productSlugs: string[] };

/** Create or update the contact and set its topic subscriptions to match `state`. Off means opt_out, so nothing is left subscribed. */
export async function syncContact(state: ContactState): Promise<Result> {
  try {
    const resend = client();
    const segmentId = need('RESEND_SEGMENT_ID');
    const email = state.email.trim().toLowerCase();
    const properties = { unsubscribe_token: signUnsubscribeToken(email) };
    const topics = [
      { id: topicId('news'), subscription: state.news ? ('opt_in' as const) : ('opt_out' as const) },
      ...projects.flatMap((p) => {
        const id = process.env[topicEnvName(`product:${p.slug}`)];
        if (!id) return [];
        return [{ id, subscription: state.product && state.productSlugs.includes(p.slug) ? ('opt_in' as const) : ('opt_out' as const) }];
      }),
    ];

    const updated = await resend.contacts.update({ email, unsubscribed: false, properties });
    if (updated.error) {
      if (updated.error.name !== 'not_found') return { ok: false, error: updated.error.message };
      const created = await resend.contacts.create({ email, properties, segments: [{ id: segmentId }], topics });
      return created.error ? { ok: false, error: created.error.message } : { ok: true, data: undefined };
    }
    const added = await resend.contacts.segments.add({ email, segmentId });
    if (added.error && added.error.name !== 'validation_error') return { ok: false, error: added.error.message };
    const set = await resend.contacts.topics.update({ email, topics });
    return set.error ? { ok: false, error: set.error.message } : { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** Send one rendered email to a single address (the signed-in admin) with working unsubscribe links and headers. */
export async function sendTestEmail(args: { to: string; subject: string; html: string; siteUrl: string }): Promise<Result> {
  try {
    const token = signUnsubscribeToken(args.to);
    const { error } = await client().emails.send({
      from: need('EMAIL_CAMPAIGN_FROM'),
      to: args.to,
      subject: `[Test] ${args.subject}`,
      html: fillPlaceholders(args.html, { token, preferencesUrl: `${args.siteUrl}/account` }),
      headers: { 'List-Unsubscribe': `<${args.siteUrl}/email/unsubscribe/one-click?t=${token}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
    return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** Create and send a Broadcast to the audience's topic. Returns the Broadcast id. */
export async function sendBroadcast(args: { audience: Audience; subject: string; html: string }): Promise<Result<{ id: string }>> {
  try {
    const { data, error } = await client().broadcasts.create({
      segmentId: need('RESEND_SEGMENT_ID'),
      topicId: topicId(args.audience),
      from: need('EMAIL_CAMPAIGN_FROM'),
      name: `${args.audience}: ${args.subject}`.slice(0, 200),
      subject: args.subject,
      html: args.html,
      send: true,
    });
    if (error || !data) return { ok: false, error: error?.message ?? 'No broadcast id returned' };
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return fail(e);
  }
}
