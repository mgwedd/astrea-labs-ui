import { describe, expect, it } from 'vitest';
import { LicenseRequestBody } from '@/lib/licensing/request';

describe('LicenseRequestBody', () => {
  it('trims and accepts a valid address', () => {
    expect(LicenseRequestBody.parse({ email: '  ann@example.com ' })).toEqual({ email: 'ann@example.com' });
  });

  it('rejects missing, malformed and overlong addresses', () => {
    for (const body of [null, {}, { email: '' }, { email: 'not-an-email' }, { email: `${'a'.repeat(250)}@x.co` }]) {
      expect(LicenseRequestBody.safeParse(body).success).toBe(false);
    }
  });
});
