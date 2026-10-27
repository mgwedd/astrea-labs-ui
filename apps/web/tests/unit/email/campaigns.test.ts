import { beforeEach, describe, expect, it, vi } from 'vitest';

const resend = vi.hoisted(() => ({ emailsSend: vi.fn(), batchSend: vi.fn(), verify: vi.fn() }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resend.emailsSend };
    batch = { send: resend.batchSend };
    webhooks = { verify: resend.verify };
  },
}));

import { BATCH_LIMIT, sendBatch, sendTestEmail, verifyWebhook, type OutgoingEmail } from '@/lib/email/campaigns';

beforeEach(() => {
  for (const fn of Object.values(resend)) fn.mockReset();
  vi.stubEnv('RESEND_API_KEY', 'k');
  vi.stubEnv('EMAIL_CAMPAIGN_FROM', 'Astrea <news@example.com>');
  vi.stubEnv('EMAIL_UNSUBSCRIBE_SECRET', 'test-secret-test-secret-test-secret-1234');
  vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_test');
});

const email = (to: string): OutgoingEmail => ({ to, subject: 'S', html: '<p>x</p>', headers: { 'List-Unsubscribe': '<u>' }, campaignId: 'c1' });

describe('sendTestEmail', () => {
  it('sends one email, to the given address only, with one-click headers and a filled link', async () => {
    resend.emailsSend.mockResolvedValue({ data: { id: 'e' }, error: null });
    await sendTestEmail({ to: 'admin@example.com', subject: 'S', html: '<a href="x?t=%%UNSUBSCRIBE_TOKEN%%">u</a>', siteUrl: 'https://astrealabs.com' });
    const args = resend.emailsSend.mock.calls[0][0];
    expect(args.to).toBe('admin@example.com');
    expect(args.headers['List-Unsubscribe']).toMatch(/^<https:\/\/astrealabs\.com\/email\/unsubscribe\/one-click\?t=.+>$/);
    expect(args.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(args.html).not.toContain('%%');
  });
});

describe('sendBatch', () => {
  it('sends each email with its own headers, a campaign tag, permissive validation and the idempotency key', async () => {
    resend.batchSend.mockResolvedValue({ data: { data: [{ id: 'r1' }, { id: 'r2' }], errors: [] }, error: null });
    const r = await sendBatch([email('a@example.com'), email('b@example.com')], 'key-1');
    expect(r).toEqual({ ok: true, data: [{ id: 'r1' }, { id: 'r2' }] });
    const [emails, opts] = resend.batchSend.mock.calls[0];
    expect(emails[0]).toMatchObject({ from: 'Astrea <news@example.com>', to: 'a@example.com', headers: { 'List-Unsubscribe': '<u>' }, tags: [{ name: 'campaign', value: 'c1' }] });
    expect(opts).toEqual({ batchValidation: 'permissive', idempotencyKey: 'key-1' });
  });

  it('lines ids up with the accepted emails when some are refused', async () => {
    resend.batchSend.mockResolvedValue({ data: { data: [{ id: 'r1' }, { id: 'r3' }], errors: [{ index: 1, message: 'bad address' }] }, error: null });
    const r = await sendBatch([email('a@example.com'), email('bad'), email('c@example.com')], 'k');
    expect(r).toEqual({ ok: true, data: [{ id: 'r1' }, { error: 'bad address' }, { id: 'r3' }] });
  });

  it('keeps ids out when the reply does not line up, rather than pin one to the wrong row', async () => {
    resend.batchSend.mockResolvedValue({ data: { data: [{ id: 'r1' }], errors: [] }, error: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await sendBatch([email('a@example.com'), email('b@example.com')], 'k');
    expect(r).toEqual({ ok: true, data: [{ id: null }, { id: null }] });
  });

  it('fails the whole batch on a request error, and refuses more than the limit', async () => {
    resend.batchSend.mockResolvedValue({ data: null, error: { name: 'rate_limit_exceeded', message: 'slow down' } });
    expect(await sendBatch([email('a@example.com')], 'k')).toEqual({ ok: false, error: 'slow down' });
    const tooMany = Array.from({ length: BATCH_LIMIT + 1 }, (_, i) => email(`u${i}@example.com`));
    expect((await sendBatch(tooMany, 'k')).ok).toBe(false);
    expect(resend.batchSend).toHaveBeenCalledTimes(1);
  });
});

describe('verifyWebhook', () => {
  const headers = (h: Record<string, string>) => new Headers(h);

  it('checks the signature with the webhook secret', () => {
    resend.verify.mockReturnValue({ type: 'email.delivered' });
    const event = verifyWebhook('{"x":1}', headers({ 'svix-id': 'i', 'svix-timestamp': 't', 'svix-signature': 's' }));
    expect(event).toEqual({ type: 'email.delivered' });
    expect(resend.verify).toHaveBeenCalledWith({ payload: '{"x":1}', headers: { id: 'i', timestamp: 't', signature: 's' }, webhookSecret: 'whsec_test' });
  });

  it('throws when signature headers are missing or the secret is unset', () => {
    expect(() => verifyWebhook('{}', headers({}))).toThrow();
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '');
    expect(() => verifyWebhook('{}', headers({ 'svix-id': 'i', 'svix-timestamp': 't', 'svix-signature': 's' }))).toThrow();
    expect(resend.verify).not.toHaveBeenCalled();
  });
});
