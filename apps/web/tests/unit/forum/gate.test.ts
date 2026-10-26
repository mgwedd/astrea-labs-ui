// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { licenses } from '@/lib/licensing/db/schema';
import { newDb } from './helpers';
import type { Db } from '@/lib/forum/service';

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
// The gate defaults to the production Neon client; tests pass a PGlite db instead.
vi.mock('@/lib/licensing/db/client', () => ({ getDb: () => ({}) }));

import { canUseForum, requireForumMember } from '@/lib/forum/gate';

let db: Db;
const NOW = new Date('2026-06-01T00:00:00Z');
const user = (email: string, extra = {}) => ({ sub: `auth0|${email}`, email, email_verified: true, ...extra });
const issue = (email: string, extra: Partial<typeof licenses.$inferInsert> = {}) =>
  db.insert(licenses).values({ lid: crypto.randomUUID(), email, kid: 'k', issuedAt: NOW, ...extra });

beforeEach(async () => {
  db = await newDb();
  getSession.mockReset();
  process.env.ADMIN_EMAILS = 'boss@example.com';
});

describe('canUseForum', () => {
  const deps = () => ({ db, now: () => NOW });
  it('is false with no session', async () => {
    expect(await canUseForum(null, deps())).toBe(false);
  });
  it('is false for a signed-in user with no license', async () => {
    expect(await canUseForum(user('nolicense@example.com'), deps())).toBe(false);
  });
  it('is true for a user with an active license, matched case-insensitively', async () => {
    await issue('member@example.com');
    expect(await canUseForum(user('Member@Example.com'), deps())).toBe(true);
  });
  it('is true for a license that does not expire or expires later', async () => {
    await issue('later@example.com', { expiresAt: new Date('2027-01-01') });
    expect(await canUseForum(user('later@example.com'), deps())).toBe(true);
  });
  it('is false for revoked and expired licenses', async () => {
    await issue('revoked@example.com', { revokedAt: NOW });
    await issue('expired@example.com', { expiresAt: new Date('2026-01-01') });
    expect(await canUseForum(user('revoked@example.com'), deps())).toBe(false);
    expect(await canUseForum(user('expired@example.com'), deps())).toBe(false);
  });
  it('is false when the email is unverified, even with a license', async () => {
    await issue('unverified@example.com');
    expect(await canUseForum(user('unverified@example.com', { email_verified: false }), deps())).toBe(false);
  });
  it('is true for an admin without a license', async () => {
    expect(await canUseForum(user('boss@example.com'), deps())).toBe(true);
  });
  it('is false for an unverified admin email', async () => {
    expect(await canUseForum(user('boss@example.com', { email_verified: false }), deps())).toBe(false);
  });
});

describe('requireForumMember', () => {
  it('redirects a signed-out visitor to sign-in, back to /forum', async () => {
    getSession.mockResolvedValue(null);
    await expect(requireForumMember(undefined, { db })).rejects.toThrow('REDIRECT:/auth/login?returnTo=%2Fforum');
  });
  it('keeps a deep return path inside /forum', async () => {
    getSession.mockResolvedValue(null);
    await expect(requireForumMember('/forum/bookmarks', { db })).rejects.toThrow('returnTo=%2Fforum%2Fbookmarks');
  });
  it('403s a signed-in user without a license', async () => {
    getSession.mockResolvedValue({ user: user('nolicense@example.com') });
    await expect(requireForumMember(undefined, { db })).rejects.toThrow('FORBIDDEN');
  });
  it('returns a viewer for a licensed member', async () => {
    await issue('member@example.com');
    getSession.mockResolvedValue({ user: user('Member@example.com') });
    await expect(requireForumMember(undefined, { db })).resolves.toEqual({ sub: 'auth0|Member@example.com', email: 'member@example.com', isAdmin: false });
  });
  it('returns an admin viewer for an admin', async () => {
    getSession.mockResolvedValue({ user: user('boss@example.com') });
    await expect(requireForumMember(undefined, { db })).resolves.toMatchObject({ isAdmin: true });
  });
});
