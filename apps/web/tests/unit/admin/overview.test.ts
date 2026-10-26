// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/lib/licensing/db/schema';
import { betaApplications, licenses, testLicenses } from '@/lib/licensing/db/schema';
import { emailCampaigns } from '@/lib/email/db/schema';
import { feedbackSubmissions } from '@/lib/feedback/db/schema';
import type { Db } from '@/lib/licensing/service';
import { getNavCounts, getOverview } from '@/lib/admin/overview';

const NOW = new Date('2026-10-25T12:00:00Z');
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const ahead = (days: number) => new Date(NOW.getTime() + days * DAY);

let db: Db;
let n = 0;

beforeEach(async () => {
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: path.join(__dirname, '../../../drizzle') });
  db = d as unknown as Db;
  n = 0;
});

const app = (email: string, status: 'submitted' | 'approved', createdAt: Date) =>
  db.insert(betaApplications).values({ id: crypto.randomUUID(), email, answers: {}, consents: [], status, createdAt });

const fb = (title: string, status: 'pending_review' | 'unconfirmed' | 'approved', over: Partial<typeof feedbackSubmissions.$inferInsert> = {}) =>
  db.insert(feedbackSubmissions).values({
    tokenHash: `h${n++}`,
    status,
    email: 'x@example.com',
    projectSlug: 'aletheia',
    type: 'bug',
    title,
    fields: {},
    expiresAt: ahead(1),
    createdAt: ago(1),
    ...over,
  });

const lic = (email: string, expiresAt: Date | null, over: Partial<typeof licenses.$inferInsert> = {}) =>
  db.insert(licenses).values({ lid: crypto.randomUUID(), email, kid: 'k', issuedAt: ago(30), expiresAt, ...over });

describe('getOverview', () => {
  it('is all zeros and empty on a fresh database', async () => {
    const o = await getOverview({ db, now: () => NOW });
    expect(o).toMatchObject({
      applicationsToReview: 0,
      feedbackToReview: 0,
      feedbackFlagged: 0,
      activeLicenses: 0,
      licensesExpiringSoon: 0,
      liveTestLicenses: 0,
      queue: [],
      lastCampaign: null,
    });
  });

  it('counts only submitted applications and pending_review feedback', async () => {
    await app('a@example.com', 'submitted', ago(2));
    await app('b@example.com', 'approved', ago(3));
    await fb('pending', 'pending_review');
    await fb('flagged', 'pending_review', { flagged: true, flagReason: 'contains a URL' });
    await fb('not confirmed', 'unconfirmed');
    await fb('done', 'approved');
    const o = await getOverview({ db, now: () => NOW });
    expect(o.applicationsToReview).toBe(1);
    expect(o.feedbackToReview).toBe(2);
    expect(o.feedbackFlagged).toBe(1);
  });

  it('counts active licenses and those expiring within 30 days, ignoring revoked, replaced and expired', async () => {
    await lic('soon@example.com', ahead(5));
    await lic('later@example.com', ahead(200));
    await lic('never@example.com', null);
    await lic('gone@example.com', ahead(5), { revokedAt: ago(1) });
    await lic('old@example.com', ahead(5), { replacedBy: crypto.randomUUID() });
    await lic('lapsed@example.com', ago(1));
    const o = await getOverview({ db, now: () => NOW });
    expect(o.activeLicenses).toBe(3);
    expect(o.licensesExpiringSoon).toBe(1);
    expect(o.queue.filter((q) => q.kind === 'license').map((q) => q.title)).toEqual(['soon@example.com']);
  });

  it('counts live test licenses only', async () => {
    const base = { kid: 'k', issuedAt: ago(1), createdBy: 'a@example.com' };
    await db.insert(testLicenses).values([
      { lid: 'test-1', label: 'live', expiresAt: ahead(1), ...base },
      { lid: 'test-2', label: 'revoked', expiresAt: ahead(1), revokedAt: ago(0.5), ...base },
      { lid: 'test-3', label: 'expired', expiresAt: ago(0.1), ...base },
    ]);
    const o = await getOverview({ db, now: () => NOW });
    expect(o.liveTestLicenses).toBe(1);
    expect(o.maxTestLicenses).toBe(3);
  });

  it('builds the queue flagged first, then oldest first, with links to the detail routes', async () => {
    await app('new@example.com', 'submitted', ago(1));
    await app('old@example.com', 'submitted', ago(4));
    await fb('plain', 'pending_review', { createdAt: ago(10) });
    await fb('risky', 'pending_review', { flagged: true, flagReason: 'possible path', createdAt: ago(0.5) });
    const o = await getOverview({ db, now: () => NOW });
    expect(o.queue.map((q) => q.title)).toEqual(['risky', 'plain', 'old@example.com', 'new@example.com']);
    const risky = o.queue[0]!;
    expect(risky.href).toBe(`/admin/feedback/${risky.id}`);
    expect(risky.meta).toContain('flagged: possible path');
    const oldest = o.queue.find((q) => q.title === 'old@example.com')!;
    expect(oldest.href).toBe(`/admin/applications/${oldest.id}`);
  });

  it('caps each list at five', async () => {
    for (let i = 0; i < 8; i++) await app(`a${i}@example.com`, 'submitted', ago(i + 1));
    const o = await getOverview({ db, now: () => NOW });
    expect(o.applicationsToReview).toBe(8);
    expect(o.queue).toHaveLength(5);
  });

  it('returns the most recent campaign', async () => {
    await db.insert(emailCampaigns).values([
      { subject: 'older', audience: 'news', sentBy: 'a@example.com', sentAt: ago(10), status: 'sent' },
      { subject: 'newer', audience: 'news', sentBy: 'a@example.com', sentAt: ago(2), status: 'failed' },
    ]);
    const o = await getOverview({ db, now: () => NOW });
    expect(o.lastCampaign).toMatchObject({ subject: 'newer', status: 'failed' });
  });
});

describe('getNavCounts', () => {
  it('returns the sidebar badge counts', async () => {
    await app('a@example.com', 'submitted', ago(1));
    await fb('one', 'pending_review');
    await fb('two', 'pending_review');
    expect(await getNavCounts({ db })).toEqual({ applications: 1, feedback: 2 });
  });
});
