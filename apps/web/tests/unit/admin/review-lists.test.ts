import { describe, expect, it } from 'vitest';
import { filterApplications, groupLicenses, parseStatus } from '@/lib/admin/review-lists';
import type { License } from '@/lib/licensing/db/schema';

const NOW = new Date('2026-01-10T00:00:00Z');
const lic = (o: Partial<License>): License => ({
  lid: 'aaaaaaaa-0000-4000-8000-000000000001',
  email: 'a@example.com',
  tier: 'beta',
  kid: 'k',
  issuedAt: new Date('2025-01-01T00:00:00Z'),
  expiresAt: null,
  revokedAt: null,
  revokedReason: null,
  revokedBy: null,
  replacedBy: null,
  renewalSentAt: null,
  attestationRequired: false,
  attestedAt: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  ...o,
});

describe('parseStatus', () => {
  it('defaults to submitted for anything unknown', () => {
    expect(parseStatus('approved')).toBe('approved');
    expect(parseStatus('bogus')).toBe('submitted');
    expect(parseStatus(undefined)).toBe('submitted');
  });
});

describe('filterApplications', () => {
  const rows = [
    { email: 'one@example.com', fullName: 'Ada Lovelace' },
    { email: 'two@example.org', fullName: null },
  ];
  it('matches email or name, case-insensitively', () => {
    expect(filterApplications(rows, 'ADA')).toHaveLength(1);
    expect(filterApplications(rows, 'example.org')).toHaveLength(1);
  });
  it('keeps everything for an empty query', () => {
    expect(filterApplications(rows, '  ')).toHaveLength(2);
  });
});

describe('groupLicenses', () => {
  const rows = [
    lic({ lid: 'aaaaaaaa-0000-4000-8000-000000000001' }),
    lic({ lid: 'aaaaaaaa-0000-4000-8000-000000000002', expiresAt: new Date('2025-06-01T00:00:00Z') }),
    lic({ lid: 'aaaaaaaa-0000-4000-8000-000000000003', replacedBy: 'aaaaaaaa-0000-4000-8000-000000000001' }),
    lic({ lid: 'aaaaaaaa-0000-4000-8000-000000000004', revokedAt: new Date('2025-02-01T00:00:00Z'), email: 'b@example.com' }),
  ];
  it('splits into issued, expired (including replaced) and revoked', () => {
    const g = groupLicenses(rows, '', NOW);
    expect(g.issued.map((l) => l.lid.slice(-1))).toEqual(['1']);
    expect(g.expired.map((l) => l.lid.slice(-1))).toEqual(['2', '3']);
    expect(g.revoked.map((l) => l.lid.slice(-1))).toEqual(['4']);
  });
  it('filters by email or license id', () => {
    expect(groupLicenses(rows, 'b@example', NOW).revoked).toHaveLength(1);
    expect(groupLicenses(rows, 'b@example', NOW).issued).toHaveLength(0);
    expect(groupLicenses(rows, '000000000002', NOW).expired).toHaveLength(1);
  });
});
