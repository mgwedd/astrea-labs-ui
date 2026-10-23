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

import { requireRoleApi } from '@/lib/auth/api';
import { requireRole, requireUser } from '@/lib/auth/gate';

beforeEach(() => {
  getSession.mockReset();
  process.env.ADMIN_EMAILS = 'me@example.com';
});

describe('requireUser', () => {
  it('sends a signed-out visitor to sign-in, back to /account', async () => {
    getSession.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow('REDIRECT:/auth/login?returnTo=%2Faccount');
  });
  it('403s an unverified email', async () => {
    getSession.mockResolvedValue({ user: { email: 'a@example.com', email_verified: false } });
    await expect(requireUser()).rejects.toThrow('FORBIDDEN');
  });
  it('returns a verified user', async () => {
    const user = { email: 'a@example.com', email_verified: true };
    getSession.mockResolvedValue({ user });
    await expect(requireUser()).resolves.toBe(user);
  });
});

describe('requireRole', () => {
  it('403s a plain user on an admin role', async () => {
    getSession.mockResolvedValue({ user: { email: 'a@example.com', email_verified: true } });
    await expect(requireRole('admin')).rejects.toThrow('FORBIDDEN');
  });
});

describe('requireRoleApi', () => {
  it('401s with no session', async () => {
    getSession.mockResolvedValue(null);
    const r = await requireRoleApi('user');
    expect(r.response?.status).toBe(401);
  });
  it('403s a user without the role', async () => {
    getSession.mockResolvedValue({ user: { email: 'a@example.com', email_verified: true } });
    const r = await requireRoleApi('admin');
    expect(r.response?.status).toBe(403);
  });
  it('returns the user when the role is held', async () => {
    getSession.mockResolvedValue({ user: { email: 'me@example.com', email_verified: true } });
    const r = await requireRoleApi('admin');
    expect(r.user?.email).toBe('me@example.com');
    expect(r.response).toBeUndefined();
  });
});
