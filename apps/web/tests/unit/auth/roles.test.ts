import { describe, expect, it } from 'vitest';
import { hasRole, rolesFor } from '@/lib/auth/roles';

const LIST = 'me@example.com, other@example.com';

describe('rolesFor', () => {
  it('gives a verified user the user role', () => {
    expect(rolesFor({ email: 'a@example.com', email_verified: true }, LIST)).toEqual(['user']);
  });
  it('adds admin for a verified allowlisted email, case-insensitively', () => {
    expect(rolesFor({ email: 'ME@Example.com', email_verified: true }, LIST)).toEqual(['user', 'admin']);
  });
  it('gives nothing without a verified email', () => {
    expect(rolesFor({ email: 'me@example.com', email_verified: false }, LIST)).toEqual([]);
    expect(rolesFor({ email: 'me@example.com' }, LIST)).toEqual([]);
    expect(rolesFor({ email_verified: true }, LIST)).toEqual([]);
    expect(rolesFor(null, LIST)).toEqual([]);
  });
  it('gives no admin when the allowlist is empty', () => {
    expect(hasRole({ email: 'me@example.com', email_verified: true }, 'admin', '')).toBe(false);
  });
});
