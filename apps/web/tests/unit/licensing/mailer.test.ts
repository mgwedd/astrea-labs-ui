// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resendSender } from '@/lib/licensing/mailer';

vi.mock('@/lib/licensing/db/client', () => ({ getDb: vi.fn() }));

const mail = {
  to: 'test@example.com',
  subject: 'License link',
  text: 'Open link',
  html: '<p>Open link</p>',
};

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('LICENSE_EMAIL_FROM', 'Astrea Labs <licenses@example.com>');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('resendSender', () => {
  it('returns the provider message id and clears the deadline', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(Response.json({ id: 'email_123' }));
    vi.stubGlobal('fetch', fetch);
    expect(await resendSender()(mail)).toBe('email_123');
    expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts a stalled send and reports a failure instead of waiting indefinitely', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal!.addEventListener('abort', () => reject(options.signal!.reason), { once: true });
          }),
      ),
    );
    const result = expect(resendSender()(mail)).rejects.toThrow('email send timed out after 10 seconds');
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not report delivery acceptance without a provider message id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({})));
    await expect(resendSender()(mail)).rejects.toThrow('email send returned no message id');
  });
});
