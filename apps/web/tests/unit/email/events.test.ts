// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import type { WebhookEventPayload } from 'resend';
import { campaignSends, emailCampaigns, emailSuppressions } from '@/lib/email/db/schema';
import { handleResendEvent } from '@/lib/email/events';
import type { Db } from '@/lib/email/sends';
import { emailDb } from './pglite';

let db: Db;
let campaignId: string;

function event(type: string, data: Record<string, unknown> = {}): WebhookEventPayload {
  return {
    type,
    created_at: '2026-10-26T00:00:00Z',
    data: { email_id: 're_1', to: ['A@x.com'], from: 'f@x.com', subject: 's', created_at: '2026-10-26T00:00:00Z', tags: { campaign: campaignId }, ...data },
  } as unknown as WebhookEventPayload;
}

const statusOf = async () => (await db.select().from(campaignSends))[0];
const suppressions = () => db.select().from(emailSuppressions);

beforeEach(async () => {
  db = await emailDb();
  const [c] = await db.insert(emailCampaigns).values({ subject: 's', audience: 'news', sentBy: 'a', status: 'sent' }).returning();
  campaignId = c.id;
  await db.insert(campaignSends).values({ campaignId, email: 'a@x.com', resendEmailId: 're_1', status: 'sent' });
});

describe('handleResendEvent', () => {
  it('marks a delivered email delivered without suppressing it', async () => {
    expect(await handleResendEvent(db, event('email.delivered'))).toBe('updated');
    expect(await statusOf()).toMatchObject({ status: 'delivered' });
    expect(await suppressions()).toEqual([]);
  });

  it('suppresses the address on a permanent bounce', async () => {
    await handleResendEvent(db, event('email.bounced', { bounce: { type: 'Permanent', subType: 'General', message: 'No such user' } }));
    expect(await statusOf()).toMatchObject({ status: 'bounced', error: 'Permanent: General: No such user' });
    expect(await suppressions()).toEqual([expect.objectContaining({ email: 'a@x.com', reason: 'bounce', resendEmailId: 're_1' })]);
  });

  it('logs a transient bounce without suppressing the address', async () => {
    await handleResendEvent(db, event('email.bounced', { bounce: { type: 'Transient', subType: 'MailboxFull', message: 'Full' } }));
    expect(await statusOf()).toMatchObject({ status: 'bounced' });
    expect(await suppressions()).toEqual([]);
  });

  it('suppresses on a complaint and on a Resend suppression', async () => {
    await handleResendEvent(db, event('email.complained'));
    expect(await statusOf()).toMatchObject({ status: 'complained' });
    await db.insert(campaignSends).values({ campaignId, email: 'b@x.com', resendEmailId: 're_2', status: 'sent' });
    await handleResendEvent(db, event('email.suppressed', { email_id: 're_2', to: ['b@x.com'], suppressed: { type: 'OnAccountSuppressionList', message: 'Suppressed' } }));
    const rows = await suppressions();
    expect(rows.map((r) => [r.email, r.reason]).sort()).toEqual([['a@x.com', 'complaint'], ['b@x.com', 'resend_suppressed']]);
  });

  it('records a failure reason', async () => {
    await handleResendEvent(db, event('email.failed', { failed: { reason: 'reached_daily_quota' } }));
    expect(await statusOf()).toMatchObject({ status: 'failed', error: 'reached_daily_quota' });
  });

  it('never moves a status backwards, and repeats are harmless', async () => {
    await handleResendEvent(db, event('email.complained'));
    await handleResendEvent(db, event('email.complained'));
    await handleResendEvent(db, event('email.delivered'));
    expect(await statusOf()).toMatchObject({ status: 'complained' });
    expect(await suppressions()).toHaveLength(1);
  });

  it('finds a row without a Resend id through the campaign tag and address', async () => {
    await db.update(campaignSends).set({ resendEmailId: null });
    await handleResendEvent(db, event('email.delivered', { email_id: 're_unknown' }));
    expect(await statusOf()).toMatchObject({ status: 'delivered' });
  });

  it('ignores a bad campaign tag, unknown emails and other event types', async () => {
    expect(await handleResendEvent(db, event('email.delivered', { email_id: 're_other', tags: { campaign: 'not-a-uuid' } }))).toBe('ignored');
    expect(await handleResendEvent(db, event('email.opened'))).toBe('ignored');
    expect(await handleResendEvent(db, event('contact.created'))).toBe('ignored');
    expect(await statusOf()).toMatchObject({ status: 'sent' });
  });
});
