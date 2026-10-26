import { beforeEach, describe, expect, it, vi } from 'vitest';

const clear = vi.hoisted(() => vi.fn());
vi.mock('@/lib/email/preferences', () => ({ clearPreferencesByEmail: clear }));

import { unsubscribeWithToken } from '@/lib/email/unsubscribe';
import { signUnsubscribeToken, TOKEN_TTL_MS } from '@/lib/email/token';

beforeEach(() => {
  clear.mockReset();
  vi.stubEnv('EMAIL_UNSUBSCRIBE_SECRET', 'test-secret-test-secret-test-secret-1234');
});

describe('unsubscribeWithToken', () => {
  it('turns everything off in the database for a valid token', async () => {
    expect(await unsubscribeWithToken(signUnsubscribeToken('a@example.com'))).toBe('done');
    expect(clear).toHaveBeenCalledWith('a@example.com');
  });

  it('changes nothing for an invalid or expired token', async () => {
    expect(await unsubscribeWithToken('garbage')).toBe('invalid');
    expect(await unsubscribeWithToken(signUnsubscribeToken('a@example.com', Date.now() - TOKEN_TTL_MS - 1000))).toBe('expired');
    expect(clear).not.toHaveBeenCalled();
  });

  it('reports failure when the database update fails', async () => {
    clear.mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await unsubscribeWithToken(signUnsubscribeToken('a@example.com'))).toBe('failed');
  });
});
