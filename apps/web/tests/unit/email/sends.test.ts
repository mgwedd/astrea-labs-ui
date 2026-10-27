// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { campaignSends, emailCampaigns, emailPreferences, emailSuppressions } from '@/lib/email/db/schema';
import type { BatchOutcome, OutgoingEmail, Result } from '@/lib/email/campaigns';
import { campaignCounts, selectRecipients, sendCampaign, type Db, type SendDeps } from '@/lib/email/sends';
import { emailDb } from './pglite';

vi.mock('@/lib/email/campaigns', () => ({ BATCH_LIMIT: 100 }));

let db: Db;
let batches: { emails: OutgoingEmail[]; key: string }[];
let reply: (emails: OutgoingEmail[]) => Result<BatchOutcome[]>;
let deps: SendDeps;

const input = { audience: 'news' as const, subject: 'Hello', html: '<p>Hi</p><a href="https://astrealabs.com/unsubscribe?t=%%UNSUBSCRIBE_TOKEN%%">Unsubscribe</a>', bodyHtml: '<p>Hi</p>', sentBy: 'admin@example.com' };

async function person(email: string, prefs: { news?: boolean; product?: string[] } = {}) {
  await db.insert(emailPreferences).values({
    auth0Sub: `sub|${email}|${Math.random()}`,
    email,
    newsOptInAt: prefs.news ? new Date() : null,
    productOptInAt: prefs.product ? new Date() : null,
    productSlugs: prefs.product ?? [],
  });
}

beforeEach(async () => {
  db = await emailDb();
  batches = [];
  reply = (emails) => ({ ok: true, data: emails.map((e) => ({ id: `re_${e.to}` })) });
  deps = {
    db,
    siteUrl: 'https://astrealabs.com',
    sign: (email) => `tok-${email.split('@')[0]}`,
    sendBatch: vi.fn(async (emails: OutgoingEmail[], key: string) => {
      batches.push({ emails, key });
      return reply(emails);
    }),
  };
});

describe('selectRecipients', () => {
  it('picks each opted-in address once, by audience, and skips suppressed addresses', async () => {
    await person('a@x.com', { news: true });
    await person('a@x.com', { news: true }); // same address on a second account
    await person('b@x.com', { product: ['aletheia'] });
    await person('c@x.com', { news: true, product: ['other'] });
    await person('d@x.com', {});
    await person('e@x.com', { news: true });
    await db.insert(emailSuppressions).values({ email: 'e@x.com', reason: 'complaint' });

    expect(await selectRecipients(db, 'news')).toEqual(['a@x.com', 'c@x.com']);
    expect(await selectRecipients(db, 'product:aletheia')).toEqual(['b@x.com']);
  });
});

describe('sendCampaign', () => {
  it('records nothing when nobody is opted in', async () => {
    await person('d@x.com', {});
    expect(await sendCampaign(deps, input)).toEqual({ status: 'no_recipients' });
    expect(await db.select().from(emailCampaigns)).toEqual([]);
    expect(deps.sendBatch).not.toHaveBeenCalled();
  });

  it('sends each recipient their own unsubscribe link and headers, and logs the Resend id', async () => {
    await person('a@x.com', { news: true });
    const out = await sendCampaign(deps, input);
    expect(out).toMatchObject({ status: 'sent', recipients: 1, failed: 0 });

    const [email] = batches[0].emails;
    expect(email.to).toBe('a@x.com');
    expect(email.html).toContain('unsubscribe?t=tok-a');
    expect(email.html).not.toContain('%%UNSUBSCRIBE_TOKEN%%');
    expect(email.headers['List-Unsubscribe']).toBe('<https://astrealabs.com/email/unsubscribe/one-click?t=tok-a>');
    expect(email.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');

    const [row] = await db.select().from(campaignSends);
    expect(row).toMatchObject({ email: 'a@x.com', status: 'sent', resendEmailId: 're_a@x.com', error: null });
    const [campaign] = await db.select().from(emailCampaigns);
    expect(campaign).toMatchObject({ status: 'sent', bodyHtml: '<p>Hi</p>', audience: 'news' });
  });

  it('splits more than 100 recipients into batches with distinct idempotency keys', async () => {
    for (let i = 0; i < 230; i++) await person(`u${String(i).padStart(3, '0')}@x.com`, { news: true });
    const out = await sendCampaign(deps, input);
    expect(out).toMatchObject({ status: 'sent', recipients: 230, failed: 0 });
    expect(batches.map((b) => b.emails.length)).toEqual([100, 100, 30]);
    expect(new Set(batches.map((b) => b.key)).size).toBe(3);
    expect(new Set(batches.flatMap((b) => b.emails.map((e) => e.to))).size).toBe(230);
  });

  it('marks refused emails failed and the campaign partial', async () => {
    await person('a@x.com', { news: true });
    await person('b@x.com', { news: true });
    reply = (emails) => ({ ok: true, data: emails.map((e) => (e.to === 'b@x.com' ? { error: 'Invalid to' } : { id: 're_a' })) });
    expect(await sendCampaign(deps, input)).toMatchObject({ status: 'partial', recipients: 2, failed: 1 });
    const rows = await db.select().from(campaignSends).orderBy(campaignSends.email);
    expect(rows.map((r) => [r.email, r.status, r.error])).toEqual([['a@x.com', 'sent', null], ['b@x.com', 'failed', 'Invalid to']]);
  });

  it('marks the whole batch failed when the request fails, and the campaign failed', async () => {
    await person('a@x.com', { news: true });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reply = () => ({ ok: false, error: 'rate limited' });
    const out = await sendCampaign(deps, input);
    expect(out).toMatchObject({ status: 'failed', recipients: 1, failed: 1 });
    if (out.status === 'no_recipients') throw new Error('unreachable');
    const [row] = await db.select().from(campaignSends).where(eq(campaignSends.campaignId, out.campaignId));
    expect(row).toMatchObject({ status: 'failed', error: 'rate limited' });
  });

  it('keeps an accepted email whose id did not line up as sent, without an id', async () => {
    await person('a@x.com', { news: true });
    reply = (emails) => ({ ok: true, data: emails.map(() => ({ id: null })) });
    expect(await sendCampaign(deps, input)).toMatchObject({ status: 'sent' });
    const [row] = await db.select().from(campaignSends);
    expect(row).toMatchObject({ status: 'sent', resendEmailId: null });
  });
});

describe('campaignCounts', () => {
  it('counts recipients, failures, bounces and complaints per campaign', async () => {
    const [c] = await db.insert(emailCampaigns).values({ subject: 's', audience: 'news', sentBy: 'a', status: 'partial' }).returning();
    await db.insert(campaignSends).values(
      (['sent', 'failed', 'bounced', 'complained', 'delivered'] as const).map((status, i) => ({ campaignId: c.id, email: `${i}@x.com`, status })),
    );
    const counts = await campaignCounts(db, [c.id, '00000000-0000-0000-0000-000000000000']);
    expect(counts.get(c.id)).toEqual({ recipients: 5, failed: 1, bounced: 1, complained: 1 });
    expect(counts.has('00000000-0000-0000-0000-000000000000')).toBe(false);
  });
});
