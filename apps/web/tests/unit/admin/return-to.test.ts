import { describe, expect, it } from 'vitest';
import { adminLoginUrl, safeAdminReturnTo } from '@/lib/admin/return-to';

describe('safeAdminReturnTo', () => {
  it('keeps /admin paths', () => {
    expect(safeAdminReturnTo('/admin')).toBe('/admin');
    expect(safeAdminReturnTo('/admin/licenses')).toBe('/admin/licenses');
    expect(safeAdminReturnTo('/admin/emails/')).toBe('/admin/emails/');
  });
  it('rejects open-redirect and non-admin targets', () => {
    for (const bad of [
      'https://evil.example/admin',
      '//evil.example',
      '/\\evil.example',
      '/administrator',
      '/admin//evil.example',
      '/admin/../secret',
      '/admin?next=https://evil.example',
      '/',
      '',
      null,
      undefined,
    ]) {
      expect(safeAdminReturnTo(bad)).toBe('/admin');
    }
  });
});

describe('adminLoginUrl', () => {
  it('encodes the target', () => {
    expect(adminLoginUrl('/admin/licenses')).toBe('/auth/login?returnTo=%2Fadmin%2Flicenses');
    expect(adminLoginUrl('https://evil.example')).toBe('/auth/login?returnTo=%2Fadmin');
  });
});
