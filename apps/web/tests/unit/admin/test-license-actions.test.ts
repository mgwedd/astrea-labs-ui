import { generateKeyPairSync } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyLicense } from '@/lib/licensing/token';

const requireAdmin = vi.fn();
vi.mock('@/lib/admin/gate', () => ({ requireAdmin: () => requireAdmin() }));
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const getSigningKey = vi.fn(() => ({ kid: 'test-kid', privateKey }));
vi.mock('@/lib/licensing/keys', () => ({ getSigningKey: () => getSigningKey() }));

import { issueTestLicenseAction } from '@/app/(admin)/admin/licenses/test-license-actions';

function form(days: string) {
  const f = new FormData();
  f.set('days', days);
  return f;
}

describe('issueTestLicenseAction', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getSigningKey.mockClear();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('stops when the admin gate rejects, before signing anything', async () => {
    requireAdmin.mockRejectedValue(new Error('FORBIDDEN'));
    await expect(issueTestLicenseAction(null, form('7'))).rejects.toThrow('FORBIDDEN');
    expect(getSigningKey).not.toHaveBeenCalled();
  });

  it('returns a signed key for the chosen length', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    const r = await issueTestLicenseAction(null, form('3'));
    expect(r?.ok).toBe(true);
    if (!r?.ok) return;
    expect(r.days).toBe(3);
    const v = verifyLicense(r.token, { 'test-kid': publicKey }, Math.floor(Date.now() / 1000));
    expect(v.ok && v.payload.tier).toBe('test');
  });

  it('rejects a length that is not offered', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    expect(await issueTestLicenseAction(null, form('365'))).toEqual({ ok: false, error: expect.any(String) });
    expect(getSigningKey).not.toHaveBeenCalled();
  });
});
