import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/licensing/db/client';
import { betaApplications, licenses, type License } from '@/lib/licensing/db/schema';

export type LicenseStatus = 'Active' | 'Revoked' | 'Replaced' | 'Expired';

export const licenseStatus = (l: Pick<License, 'revokedAt' | 'replacedBy' | 'expiresAt'>, now = new Date()): LicenseStatus =>
  l.revokedAt ? 'Revoked' : l.replacedBy ? 'Replaced' : l.expiresAt && l.expiresAt <= now ? 'Expired' : 'Active';

/** Licenses and beta applications for one (lowercased) email, newest first. The `/account` page and `/api/v1/account` share this. */
export async function getAccountRecords(email: string) {
  const db = getDb();
  const [mine, applications] = await Promise.all([
    db.select().from(licenses).where(eq(licenses.email, email)).orderBy(desc(licenses.issuedAt)),
    db.select().from(betaApplications).where(eq(betaApplications.email, email)).orderBy(desc(betaApplications.createdAt)),
  ]);
  return { licenses: mine, applications };
}

/** The JSON form returned by `/api/v1/account`: statuses and dates only, never keys or answers. */
export async function getAccountSummary(email: string) {
  const { licenses: mine, applications } = await getAccountRecords(email);
  const now = new Date();
  return {
    email,
    licenses: mine.map((l) => ({
      product: 'Aletheia',
      tier: l.tier,
      status: licenseStatus(l, now),
      issuedAt: l.issuedAt.toISOString(),
      expiresAt: l.expiresAt?.toISOString() ?? null,
    })),
    betaApplications: applications.map((a) => ({
      product: 'Aletheia',
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export type AccountSummary = Awaited<ReturnType<typeof getAccountSummary>>;
