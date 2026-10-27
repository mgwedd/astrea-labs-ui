// @vitest-environment node
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';
import { allBlocks, defineAgreement, type AgreementDefinition } from '@/lib/agreements/define';
import { agreementSha256, sha256Hex } from '@/lib/agreements/evidence';
import { acceptAgreement, currentAcceptance, RATE_LIMIT_PER_HOUR, type Db } from '@/lib/agreements/service';
import { agreementAcceptances } from '@/lib/agreements/db/schema';
import { AcceptSchema } from '@/lib/agreements/validation';
import { betaAgreement, documentBlocks } from '@/lib/beta-access/content';

const ALETHEIA_BETA = betaAgreement('2026-10-24');
const DOCUMENT_BLOCKS = documentBlocks('2026-10-24');

const TERMS = defineAgreement({
  id: 'test-terms',
  version: '1',
  level: 'accept',
  title: 'Test terms',
  terms: [{ id: 'T1', title: 'Use', text: 'Plain **terms**.' }],
  checkboxes: [
    { id: 'A1', text: 'I agree.' },
    { id: 'A2', text: 'Send me news.', optional: true },
  ],
});

const NOW = new Date('2026-10-23T12:00:00Z');
const iso = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString();

let db: Db;
const deps = () => ({ db, now: () => NOW });
const input = (over: Partial<Parameters<typeof acceptAgreement>[1]> = {}) => ({
  definition: TERMS as AgreementDefinition,
  version: '1',
  subject: 'a@example.com',
  subjectVerified: false,
  shownAt: iso(60_000),
  tickedAt: { A1: iso(30_000) },
  meta: { ip: '203.0.113.1', ua: 'test' },
  ...over,
});

beforeEach(async () => {
  const pg = new PGlite();
  const d = drizzle(pg);
  await migrate(d, { migrationsFolder: path.join(__dirname, '../../../drizzle') });
  db = d as unknown as Db;
});

describe('defineAgreement', () => {
  const base = { id: 'x', version: '1', title: 'X', terms: [], checkboxes: [{ id: 'A', text: 'a' }] };
  it('rejects duplicate ids', () => {
    expect(() => defineAgreement({ ...base, level: 'accept', terms: [{ id: 'A', text: 't' }] })).toThrow(/duplicate/);
  });
  it('needs a required checkbox', () => {
    expect(() => defineAgreement({ ...base, level: 'accept', checkboxes: [] })).toThrow(/at least one checkbox/);
    expect(() => defineAgreement({ ...base, level: 'accept', checkboxes: [{ id: 'A', text: 'a', optional: true }] })).toThrow(/required/);
  });
  it('ties signing consent to the signed level', () => {
    expect(() => defineAgreement({ ...base, level: 'signed' })).toThrow(/signing consent/);
    expect(() => defineAgreement({ ...base, level: 'accept', signingConsent: { id: 'S', text: 's' } })).toThrow(/no signing consent/);
  });
});

describe('Aletheia beta as a signed definition', () => {
  it('keeps the document order', () => {
    expect(ALETHEIA_BETA.level).toBe('signed');
    expect(DOCUMENT_BLOCKS.map((b) => b.id)).toEqual(allBlocks(ALETHEIA_BETA).map((b) => b.id));
    expect(DOCUMENT_BLOCKS.at(-1)?.id).toBe('C12');
    expect(DOCUMENT_BLOCKS[0]?.id).toBe('H0');
  });
  it('pins the block order and document hash (a change here needs a DOC_VERSION bump)', () => {
    const n = (p: string, a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => `${p}${a + i}`);
    expect(DOCUMENT_BLOCKS.map((b) => b.id)).toEqual([...n('H', 0, 8), ...n('B', 1, 8), 'B0', ...n('C', 1, 10), 'C12']);
    expect(agreementSha256(ALETHEIA_BETA)).toBe('61dcb9019ed2761b708e39b1904dc3ef7ea7c874dd63523537888d7ec6594f98');
  });
});

describe('acceptAgreement', () => {
  it('stores an evidence row with hashes and tick times', async () => {
    const out = await acceptAgreement(deps(), input({ subjectVerified: true }));
    expect(out.ok).toBe(true);
    const [row] = await db.select().from(agreementAcceptances);
    expect(row).toMatchObject({
      agreementId: 'test-terms',
      version: '1',
      sha256: agreementSha256(TERMS),
      subject: 'a@example.com',
      subjectVerified: true,
      ip: '203.0.113.1',
    });
    expect(row!.acceptedAt.toISOString()).toBe(NOW.toISOString());
    expect(row!.ticks).toEqual([{ id: 'A1', version: '1', sha256: sha256Hex('I agree.'), tickedAt: iso(30_000) }]);
    expect(await currentAcceptance(deps(), TERMS, 'a@example.com')).toMatchObject({ id: row!.id });
  });

  it('ignores unverified rows in currentAcceptance unless asked', async () => {
    await acceptAgreement(deps(), input({ subjectVerified: false }));
    expect(await currentAcceptance(deps(), TERMS, 'a@example.com')).toBeUndefined();
    expect(await currentAcceptance(deps(), TERMS, 'a@example.com', { includeUnverified: true })).toBeDefined();
  });

  it('corrects for a client clock that runs fast', async () => {
    const fast = 2 * 60_000;
    const ahead = (msAgo: number) => new Date(NOW.getTime() - msAgo + fast).toISOString();
    const out = await acceptAgreement(deps(), input({ shownAt: ahead(60_000), tickedAt: { A1: ahead(30_000) }, sentAt: ahead(0) }));
    expect(out.ok).toBe(true);
    const [row] = await db.select().from(agreementAcceptances);
    expect(row!.shownAt.toISOString()).toBe(iso(60_000));
    expect(row!.ticks[0]!.tickedAt).toBe(iso(30_000));
  });

  it('rejects a signed definition', async () => {
    expect(await acceptAgreement(deps(), input({ definition: ALETHEIA_BETA }))).toEqual({ ok: false, error: 'not_simple' });
  });

  it('rejects a stale version, unknown or missing boxes', async () => {
    expect(await acceptAgreement(deps(), input({ version: '0' }))).toEqual({ ok: false, error: 'stale_version' });
    expect(await acceptAgreement(deps(), input({ tickedAt: { A2: iso(1000) } }))).toEqual({ ok: false, error: 'missing_required' });
    expect(await acceptAgreement(deps(), input({ tickedAt: { A1: iso(1000), T1: iso(1000) } }))).toEqual({ ok: false, error: 'unknown_box' });
  });

  it('rejects implausible times', async () => {
    expect(await acceptAgreement(deps(), input({ shownAt: iso(25 * 3_600_000) }))).toEqual({ ok: false, error: 'bad_time' });
    expect(await acceptAgreement(deps(), input({ shownAt: iso(-5 * 60_000) }))).toEqual({ ok: false, error: 'bad_time' });
    expect(await acceptAgreement(deps(), input({ tickedAt: { A1: iso(10 * 60_000) } }))).toEqual({ ok: false, error: 'bad_time' });
    expect(await acceptAgreement(deps(), input({ tickedAt: { A1: 'nope' } }))).toEqual({ ok: false, error: 'bad_time' });
  });

  it('rate-limits per subject', async () => {
    for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) expect((await acceptAgreement(deps(), input())).ok).toBe(true);
    expect(await acceptAgreement(deps(), input())).toEqual({ ok: false, error: 'rate_limited' });
    expect((await acceptAgreement(deps(), input({ subject: 'b@example.com' }))).ok).toBe(true);
  });

  it('is append-only', async () => {
    await acceptAgreement(deps(), input());
    for (const stmt of [sql`update agreement_acceptances set subject = 'x'`, sql`delete from agreement_acceptances`, sql`truncate agreement_acceptances`]) {
      const err = await db.execute(stmt).then(() => null, (e: Error & { cause?: Error }) => e);
      expect(err?.cause?.message ?? err?.message).toMatch(/append-only: (UPDATE|DELETE|TRUNCATE) is not allowed/);
    }
    expect(await db.select().from(agreementAcceptances)).toHaveLength(1);
  });
});

describe('AcceptSchema', () => {
  it('lower-cases the email and requires ISO times', () => {
    const ok = AcceptSchema.safeParse({ agreementId: 'x', version: '1', email: ' A@Example.com ', shownAt: NOW.toISOString(), tickedAt: { A1: NOW.toISOString() }, sentAt: NOW.toISOString() });
    expect(ok.success && ok.data.email).toBe('a@example.com');
    expect(AcceptSchema.safeParse({ agreementId: 'x', version: '1', email: 'a@example.com', shownAt: 'today', tickedAt: {} }).success).toBe(false);
  });
});
