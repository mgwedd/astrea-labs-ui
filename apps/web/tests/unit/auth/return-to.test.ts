import { describe, expect, it } from 'vitest';
import { gatedArea, loginUrl, safeReturnTo } from '@/lib/auth/return-to';

describe('safeReturnTo', () => {
  it('keeps paths inside the area', () => {
    expect(safeReturnTo('/account', 'account')).toBe('/account');
    expect(safeReturnTo('/account/licenses', 'account')).toBe('/account/licenses');
    expect(safeReturnTo('/admin/emails', 'admin')).toBe('/admin/emails');
  });
  it('falls back to the area root for anything else', () => {
    for (const bad of ['/admin', 'https://evil.com', '//evil.com', '/account/../admin', '/accounts', '/account?x=1', '', null, undefined]) {
      expect(safeReturnTo(bad as string, 'account')).toBe('/account');
    }
    expect(safeReturnTo('/account', 'admin')).toBe('/admin');
  });
  it('builds an encoded login URL', () => {
    expect(loginUrl('/account/x', 'account')).toBe('/auth/login?returnTo=%2Faccount%2Fx');
  });
});

describe('gatedArea', () => {
  it('gates /admin and /account but leaves the invite landing public', () => {
    expect(gatedArea('/admin/emails')).toBe('admin');
    expect(gatedArea('/account')).toBe('account');
    expect(gatedArea('/account/anything')).toBe('account');
    expect(gatedArea('/account/join')).toBeNull();
    expect(gatedArea('/accounting')).toBeNull();
    expect(gatedArea('/writing')).toBeNull();
  });
  it('gates /forum and keeps its sign-in return inside it', () => {
    expect(gatedArea('/forum')).toBe('forum');
    expect(gatedArea('/forum/bookmarks')).toBe('forum');
    expect(gatedArea('/forumla')).toBeNull();
    expect(loginUrl('/forum/new', 'forum')).toBe('/auth/login?returnTo=%2Fforum%2Fnew');
    expect(safeReturnTo('/admin', 'forum')).toBe('/forum');
  });
});
