import { describe, expect, it } from 'vitest';
import { isAdminUser, parseAdminEmails } from '@/lib/admin/allowlist';

const list = 'a@example.com, B@Example.com ,';

describe('parseAdminEmails', () => {
  it('trims, lowercases and drops empties', () => {
    expect(parseAdminEmails(list)).toEqual(['a@example.com', 'b@example.com']);
  });
  it('returns nothing when unset', () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
  });
});

describe('isAdminUser', () => {
  it('admits a verified, listed email regardless of case', () => {
    expect(isAdminUser({ email: 'b@example.com', email_verified: true }, list)).toBe(true);
    expect(isAdminUser({ email: 'A@EXAMPLE.COM', email_verified: true }, list)).toBe(true);
  });
  it('rejects an unverified email', () => {
    expect(isAdminUser({ email: 'a@example.com', email_verified: false }, list)).toBe(false);
    expect(isAdminUser({ email: 'a@example.com' }, list)).toBe(false);
  });
  it('rejects an unlisted email', () => {
    expect(isAdminUser({ email: 'c@example.com', email_verified: true }, list)).toBe(false);
  });
  it('rejects a missing user or email', () => {
    expect(isAdminUser(undefined, list)).toBe(false);
    expect(isAdminUser({ email_verified: true }, list)).toBe(false);
  });
  it('rejects everyone when the allowlist is empty or unset', () => {
    expect(isAdminUser({ email: 'a@example.com', email_verified: true }, '')).toBe(false);
    expect(isAdminUser({ email: 'a@example.com', email_verified: true }, undefined)).toBe(false);
  });
});
