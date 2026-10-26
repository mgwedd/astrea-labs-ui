import { beforeEach, describe, expect, it, vi } from 'vitest';

const resend = vi.hoisted(() => ({
  broadcastsCreate: vi.fn(),
  emailsSend: vi.fn(),
  contactsUpdate: vi.fn(),
  contactsCreate: vi.fn(),
  segmentsAdd: vi.fn(),
  topicsUpdate: vi.fn(),
}));
vi.mock('resend', () => ({
  Resend: class {
    broadcasts = { create: resend.broadcastsCreate };
    emails = { send: resend.emailsSend };
    contacts = {
      update: resend.contactsUpdate,
      create: resend.contactsCreate,
      segments: { add: resend.segmentsAdd },
      topics: { update: resend.topicsUpdate },
    };
  },
}));

import { sendBroadcast, sendTestEmail, syncContact } from '@/lib/email/campaigns';

beforeEach(() => {
  for (const fn of Object.values(resend)) fn.mockReset();
  vi.stubEnv('RESEND_API_KEY', 'k');
  vi.stubEnv('RESEND_SEGMENT_ID', 'seg-1');
  vi.stubEnv('EMAIL_CAMPAIGN_FROM', 'Astrea <news@example.com>');
  vi.stubEnv('EMAIL_UNSUBSCRIBE_SECRET', 'test-secret-test-secret-test-secret-1234');
  vi.stubEnv('RESEND_TOPIC_NEWS', 'topic-news');
  vi.stubEnv('RESEND_TOPIC_PRODUCT_ALETHEIA', 'topic-aletheia');
  vi.stubEnv('RESEND_TOPIC_PRODUCT_GROUNDWORK', 'topic-groundwork');
});

describe('sendBroadcast', () => {
  it('targets only the lab news topic for the news audience', async () => {
    resend.broadcastsCreate.mockResolvedValue({ data: { id: 'b1' }, error: null });
    const r = await sendBroadcast({ audience: 'news', subject: 'S', html: '<p>x</p>' });
    expect(r).toEqual({ ok: true, data: { id: 'b1' } });
    expect(resend.broadcastsCreate).toHaveBeenCalledWith(expect.objectContaining({ topicId: 'topic-news', segmentId: 'seg-1', send: true }));
  });

  it('targets only that app topic for a product audience', async () => {
    resend.broadcastsCreate.mockResolvedValue({ data: { id: 'b2' }, error: null });
    await sendBroadcast({ audience: 'product:aletheia', subject: 'S', html: '<p>x</p>' });
    expect(resend.broadcastsCreate).toHaveBeenCalledTimes(1);
    expect(resend.broadcastsCreate.mock.calls[0][0].topicId).toBe('topic-aletheia');
  });

  it('returns an error instead of throwing when Resend fails or the topic is not configured', async () => {
    resend.broadcastsCreate.mockResolvedValue({ data: null, error: { name: 'x', message: 'boom' } });
    expect(await sendBroadcast({ audience: 'news', subject: 'S', html: 'h' })).toEqual({ ok: false, error: 'boom' });
    vi.stubEnv('RESEND_TOPIC_NEWS', '');
    expect((await sendBroadcast({ audience: 'news', subject: 'S', html: 'h' })).ok).toBe(false);
  });
});

describe('sendTestEmail', () => {
  it('sends one email, to the given address only, with one-click headers', async () => {
    resend.emailsSend.mockResolvedValue({ data: { id: 'e' }, error: null });
    await sendTestEmail({ to: 'admin@example.com', subject: 'S', html: '<a href="x?t={{{contact.unsubscribe_token}}}">u</a>', siteUrl: 'https://astrealabs.com' });
    const args = resend.emailsSend.mock.calls[0][0];
    expect(args.to).toBe('admin@example.com');
    expect(args.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(args.html).not.toContain('{{{');
    expect(resend.broadcastsCreate).not.toHaveBeenCalled();
  });
});

describe('syncContact', () => {
  const base = { email: 'U@Example.com', productSlugs: ['aletheia'] };

  it('opts in to the chosen topics and out of the rest', async () => {
    resend.contactsUpdate.mockResolvedValue({ data: { id: 'c' }, error: null });
    resend.segmentsAdd.mockResolvedValue({ data: {}, error: null });
    resend.topicsUpdate.mockResolvedValue({ data: {}, error: null });
    expect((await syncContact({ ...base, product: true, news: false })).ok).toBe(true);
    const { email, topics } = resend.topicsUpdate.mock.calls[0][0];
    expect(email).toBe('u@example.com');
    expect(topics).toEqual(
      expect.arrayContaining([
        { id: 'topic-news', subscription: 'opt_out' },
        { id: 'topic-aletheia', subscription: 'opt_in' },
        { id: 'topic-groundwork', subscription: 'opt_out' },
      ]),
    );
  });

  it('opts out of everything when both are off', async () => {
    resend.contactsUpdate.mockResolvedValue({ data: { id: 'c' }, error: null });
    resend.segmentsAdd.mockResolvedValue({ data: {}, error: null });
    resend.topicsUpdate.mockResolvedValue({ data: {}, error: null });
    await syncContact({ ...base, productSlugs: [], product: false, news: false });
    expect(resend.topicsUpdate.mock.calls[0][0].topics.every((t: { subscription: string }) => t.subscription === 'opt_out')).toBe(true);
  });

  it('creates the contact with its segment and topics when it does not exist', async () => {
    resend.contactsUpdate.mockResolvedValue({ data: null, error: { name: 'not_found', message: 'nf' } });
    resend.contactsCreate.mockResolvedValue({ data: { id: 'c' }, error: null });
    expect((await syncContact({ ...base, product: false, news: true })).ok).toBe(true);
    expect(resend.contactsCreate.mock.calls[0][0]).toMatchObject({ email: 'u@example.com', segments: [{ id: 'seg-1' }] });
    expect(resend.topicsUpdate).not.toHaveBeenCalled();
  });
});
