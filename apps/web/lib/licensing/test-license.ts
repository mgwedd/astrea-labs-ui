// Short-lived test licenses for the owner to try a new build before telling users.
// Signed with the production key so release builds accept them, but never stored:
// no license row, no key link, no email. They can't be revoked, so they are kept
// short (TEST_LICENSE_DAYS) and simply run out.
import { randomUUID } from 'node:crypto';
import { CLAIMS_BY_TIER, signLicense, type LicensePayload, type SigningKey } from './token';

export const TEST_LICENSE_DAYS = [1, 3, 7, 30] as const;
export type TestLicenseDays = (typeof TEST_LICENSE_DAYS)[number];

export type TestLicense = { token: string; lid: string; expiresAt: Date };

export function mintTestLicense(
  key: SigningKey,
  { days, by, now = new Date() }: { days: TestLicenseDays; by: string; now?: Date },
): TestLicense {
  if (!TEST_LICENSE_DAYS.includes(days)) throw new Error(`test licenses last ${TEST_LICENSE_DAYS.join(', ')} days`);
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + days * 86_400;
  const lid = `test-${randomUUID()}`;
  const payload: LicensePayload = {
    v: 1,
    kid: key.kid,
    lid,
    sub: `Test license (${by})`,
    tier: 'test',
    iat,
    exp,
    cl: [...CLAIMS_BY_TIER.test],
  };
  return { token: signLicense(payload, key), lid, expiresAt: new Date(exp * 1000) };
}
