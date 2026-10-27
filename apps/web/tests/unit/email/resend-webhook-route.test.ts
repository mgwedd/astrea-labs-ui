// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ verify: vi.fn(), handle: vi.fn() }));
vi.mock('@/lib/email/campaigns', () => ({ verifyWebhook: m.verify }));
vi.mock('@/lib/email/events', () => ({ handleResendEvent: m.handle }));
vi.mock('@/lib/licensing/db/client', () => ({ getDb: () => ({}) }));

import { POST } from '@/app/api/email/resend-webhook/route';

const req = () => new Request('https://astrealabs.com/api/email/resend-webhook', { method: 'POST', body: '{"type":"email.delivered"}' });

beforeEach(() => {
  vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_test');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /api/email/resend-webhook', () => {
  it('rejects a bad signature without touching the database', async () => {
    m.verify.mockImplementation(() => {
      throw new Error('bad signature');
    });
    expect((await POST(req())).status).toBe(400);
    expect(m.handle).not.toHaveBeenCalled();
  });

  it('handles a verified event and verifies against the raw body', async () => {
    m.verify.mockReturnValue({ type: 'email.delivered' });
    m.handle.mockResolvedValue('updated');
    expect((await POST(req())).status).toBe(204);
    expect(m.verify.mock.calls[0][0]).toBe('{"type":"email.delivered"}');
    expect(m.handle).toHaveBeenCalledWith({}, { type: 'email.delivered' });
  });

  it('returns 500 so Resend retries when the database write fails', async () => {
    m.verify.mockReturnValue({ type: 'email.delivered' });
    m.handle.mockRejectedValue(new Error('db down'));
    expect((await POST(req())).status).toBe(500);
  });

  it('returns 500 when the secret is not configured', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '');
    expect((await POST(req())).status).toBe(500);
    expect(m.verify).not.toHaveBeenCalled();
  });
});
