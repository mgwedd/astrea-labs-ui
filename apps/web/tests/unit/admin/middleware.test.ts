// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const getSession = vi.fn();
vi.mock('@/lib/auth0', () => ({
  auth0: { middleware: async () => NextResponse.next(), getSession: (...a: unknown[]) => getSession(...a) },
}));

import { middleware } from '../../../middleware';

const req = (path: string, host = 'astrealabs.com') =>
  new NextRequest(`https://${host}${path}`, { headers: { host } });

describe('middleware admin routes', () => {
  beforeEach(() => getSession.mockReset());

  it('sends a signed-out visitor to sign-in, keeping the requested admin path', async () => {
    getSession.mockResolvedValue(null);
    const res = await middleware(req('/admin/licenses'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://astrealabs.com/auth/login?returnTo=%2Fadmin%2Flicenses');
  });
  it('lets a signed-in visitor through and tags the response', async () => {
    getSession.mockResolvedValue({ user: {} });
    const res = await middleware(req('/admin'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-astrea-subdomain')).toBe('root');
  });
  it('does not touch admin paths on a project subdomain', async () => {
    const res = await middleware(req('/admin', 'sda.astrealabs.com'));
    expect(res.headers.get('location')).toBe('https://astrealabs.com/admin');
    expect(getSession).not.toHaveBeenCalled();
  });
});

describe('middleware account routes', () => {
  beforeEach(() => getSession.mockReset());

  it('sends a signed-out visitor to sign-in, back to the account page', async () => {
    getSession.mockResolvedValue(null);
    const res = await middleware(req('/account'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://astrealabs.com/auth/login?returnTo=%2Faccount');
  });
  it('leaves the invite landing page public', async () => {
    const res = await middleware(req('/account/join'));
    expect(res.status).toBe(200);
    expect(getSession).not.toHaveBeenCalled();
  });
});
