'use server';

// Issues a test license and hands the token straight back to the page. Nothing is
// written to the database; one log line records who issued which license id.

import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/gate';
import { getSigningKey } from '@/lib/licensing/keys';
import { mintTestLicense, TEST_LICENSE_DAYS, type TestLicenseDays } from '@/lib/licensing/test-license';

export type TestLicenseState =
  | { ok: true; token: string; expiresAt: string; days: number }
  | { ok: false; error: string }
  | null;

const Days = z.coerce
  .number()
  .refine((d): d is TestLicenseDays => (TEST_LICENSE_DAYS as readonly number[]).includes(d));

export async function issueTestLicenseAction(_prev: TestLicenseState, form: FormData): Promise<TestLicenseState> {
  const user = await requireAdmin();
  const days = Days.safeParse(form.get('days'));
  if (!days.success) return { ok: false, error: 'Pick how long the license lasts.' };
  const license = mintTestLicense(getSigningKey(), { days: days.data as TestLicenseDays, by: user.email });
  console.info('test license issued', { lid: license.lid, by: user.email, expiresAt: license.expiresAt.toISOString() });
  return { ok: true, token: license.token, expiresAt: license.expiresAt.toISOString(), days: days.data };
}
