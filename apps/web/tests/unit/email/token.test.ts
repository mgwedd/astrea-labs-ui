import { describe, expect, it } from 'vitest';
import { signUnsubscribeToken, TOKEN_TTL_MS, verifyUnsubscribeToken } from '@/lib/email/token';

const SECRET = 'test-secret-test-secret-test-secret-1234';
const NOW = Date.UTC(2026, 0, 1);

describe('unsubscribe token', () => {
  it('round-trips and lowercases the address', () => {
    const t = signUnsubscribeToken('A@Example.com', NOW, SECRET);
    expect(verifyUnsubscribeToken(t, NOW + 1000, SECRET)).toEqual({ ok: true, email: 'a@example.com' });
  });

  it('rejects a tampered payload', () => {
    const [, sig] = signUnsubscribeToken('a@example.com', NOW, SECRET).split('.');
    const [forged] = signUnsubscribeToken('victim@example.com', NOW, SECRET).split('.');
    expect(verifyUnsubscribeToken(`${forged}.${sig}`, NOW, SECRET)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a tampered signature and a token signed with another secret', () => {
    const t = signUnsubscribeToken('a@example.com', NOW, SECRET);
    expect(verifyUnsubscribeToken(`${t}x`, NOW, SECRET)).toEqual({ ok: false, reason: 'invalid' });
    expect(verifyUnsubscribeToken(t, NOW, 'another-secret-another-secret-123456')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects an expired token', () => {
    const t = signUnsubscribeToken('a@example.com', NOW, SECRET);
    expect(verifyUnsubscribeToken(t, NOW + TOKEN_TTL_MS + 1, SECRET)).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects junk', () => {
    for (const v of [undefined, '', 'abc', 'a.b.c', 42]) expect(verifyUnsubscribeToken(v, NOW, SECRET).ok).toBe(false);
  });
});
