import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
vi.mock('@/lib/auth0', () => ({ auth0: { getSession: (...a: unknown[]) => getSession(...a) } }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  forbidden: () => {
    throw new Error('FORBIDDEN');
  },
}));

import { requireAdmin } from '@/lib/admin/gate';

describe('requireAdmin', () => {
  beforeEach(() => {
    getSession.mockReset();
    process.env.ADMIN_EMAILS = 'me@example.com';
  });

  it('redirects to sign-in when signed out', async () => {
    getSession.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/auth/login?returnTo=%2Fadmin');
  });
  it('403s a signed-in user who is not on the allowlist', async () => {
    getSession.mockResolvedValue({ user: { email: 'other@example.com', email_verified: true } });
    await expect(requireAdmin()).rejects.toThrow('FORBIDDEN');
  });
  it('403s a listed user whose email is unverified', async () => {
    getSession.mockResolvedValue({ user: { email: 'me@example.com', email_verified: false } });
    await expect(requireAdmin()).rejects.toThrow('FORBIDDEN');
  });
  it('returns the user for a verified, listed email', async () => {
    const user = { email: 'me@example.com', email_verified: true };
    getSession.mockResolvedValue({ user });
    await expect(requireAdmin()).resolves.toBe(user);
  });
});
