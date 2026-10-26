import { licenseState, type LicenseState } from '@/lib/admin/format';
import type { License } from '@/lib/licensing/db/schema';

export const APPLICATION_STATUSES = ['submitted', 'approved', 'declined', 'draft'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const parseStatus = (v: unknown): ApplicationStatus => APPLICATION_STATUSES.find((s) => s === v) ?? 'submitted';

const matches = (q: string, ...fields: (string | null | undefined)[]) => {
  const needle = q.trim().toLowerCase();
  return !needle || fields.some((f) => f?.toLowerCase().includes(needle));
};

/** Applications whose email or name contains q (case-insensitive). An empty q keeps everything. */
export function filterApplications<T extends { email: string; fullName: string | null }>(rows: T[], q: string): T[] {
  return rows.filter((r) => matches(q, r.email, r.fullName));
}

export type LicenseGroups = { issued: License[]; expired: License[]; revoked: License[] };

/** Splits licenses for the board: active, expired or replaced, and revoked. Filters by email or license id. */
export function groupLicenses(rows: License[], q: string, now = new Date()): LicenseGroups {
  const groups: LicenseGroups = { issued: [], expired: [], revoked: [] };
  for (const l of rows) {
    if (!matches(q, l.email, l.lid)) continue;
    const state: LicenseState = licenseState(l, now);
    if (state === 'active') groups.issued.push(l);
    else if (state === 'revoked') groups.revoked.push(l);
    else groups.expired.push(l);
  }
  return groups;
}
