import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { mintTestLicense, TEST_LICENSE_DAYS } from '@/lib/licensing/test-license';
import { verifyLicense } from '@/lib/licensing/token';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const key = { kid: 'test-kid', privateKey };
const now = new Date('2026-10-25T12:00:00Z');
const nowS = Math.floor(now.getTime() / 1000);

describe('mintTestLicense', () => {
  for (const days of TEST_LICENSE_DAYS) {
    it(`signs a ${days}-day test license the app can verify`, () => {
      const { token, lid, expiresAt } = mintTestLicense(key, { days, by: 'admin@example.com', now });
      const r = verifyLicense(token, { 'test-kid': publicKey }, nowS);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.payload).toMatchObject({ tier: 'test', lid, iat: nowS, exp: nowS + days * 86_400 });
      expect(r.payload.sub).toContain('admin@example.com');
      expect(r.payload.acc).toBeUndefined();
      expect(lid).toMatch(/^test-[0-9a-f-]{36}$/);
      expect(expiresAt.getTime()).toBe((nowS + days * 86_400) * 1000);
    });
  }

  it('runs out after its days', () => {
    const { token } = mintTestLicense(key, { days: 1, by: 'admin@example.com', now });
    expect(verifyLicense(token, { 'test-kid': publicKey }, nowS + 86_401)).toEqual({ ok: false, reason: 'expired' });
  });

  it('gives each license its own id', () => {
    const a = mintTestLicense(key, { days: 1, by: 'a', now });
    const b = mintTestLicense(key, { days: 1, by: 'a', now });
    expect(a.lid).not.toBe(b.lid);
  });

  it('refuses other lengths', () => {
    expect(() => mintTestLicense(key, { days: 365 as 30, by: 'a', now })).toThrow();
  });
});
