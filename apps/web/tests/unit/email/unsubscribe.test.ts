import { beforeEach, describe, expect, it, vi } from 'vitest';

const clear = vi.hoisted(() => vi.fn());
const sync = vi.hoisted(() => vi.fn());
vi.mock('@/lib/email/preferences', () => ({ clearPreferencesByEmail: clear }));
vi.mock('@/lib/email/campaigns', () => ({ syncContact: sync }));

import { unsubscribeWithToken } from '@/lib/email/unsubscribe';
import { signUnsubscribeToken, TOKEN_TTL_MS } from '@/lib/email/token';

beforeEach(() => {
  clear.mockReset();
  sync.mockReset();
  vi.stubEnv('EMAIL_UNSUBSCRIBE_SECRET', 'test-secret-test-secret-test-secret-1234');
});

describe('unsubscribeWithToken', () => {
  it('updates the database and Resend for a valid token', async () => {
    sync.mockResolvedValue({ ok: true, data: undefined });
    expect(await unsubscribeWithToken(signUnsubscribeToken('a@example.com'))).toBe('done');
    expect(clear).toHaveBeenCalledWith('a@example.com');
    expect(sync).toHaveBeenCalledWith({ email: 'a@example.com', product: false, news: false, productSlugs: [] });
  });

  it('changes nothing for an invalid or expired token', async () => {
    expect(await unsubscribeWithToken('garbage')).toBe('invalid');
    expect(await unsubscribeWithToken(signUnsubscribeToken('a@example.com', Date.now() - TOKEN_TTL_MS - 1000))).toBe('expired');
    expect(clear).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });

  it('reports failure when Resend fails', async () => {
    sync.mockResolvedValue({ ok: false, error: 'down' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await unsubscribeWithToken(signUnsubscribeToken('a@example.com'))).toBe('failed');
  });
});
