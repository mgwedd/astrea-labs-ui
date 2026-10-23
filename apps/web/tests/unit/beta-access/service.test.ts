// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { generateKeyPairSync, verify } from 'node:crypto';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq, sql } from 'drizzle-orm';
import * as schema from '@/lib/licensing/db/schema';
import { betaApplications, documentReviews, emailSends, keyLinks, licenses, signedDocuments } from '@/lib/licensing/db/schema';
import type { Mail } from '@/lib/licensing/email';
import { addMonths, requestLicense, type Db } from '@/lib/licensing/service';
import { LICENSE_PREFIX, publicKeyFromRaw, rawPublicKey, verifyLicense } from '@/lib/licensing/token';
import { applicationInputSchema } from '@/lib/beta-access/answers';
import { memoryBlobStore, type BlobStore } from '@/lib/agreements/signed/blob';
import { REQUIRED_AT_APPLY } from '@/lib/beta-access/content';
import { sha256Hex } from '@/lib/beta-access/hash';
import { devPublicKey, devSealer, sealMessage } from '@/lib/agreements/signed/seal';
import {
  apply,
  approve,
  auditPath,
  cleanupDrafts,
  decline,
  getApplication,
  getDocument,
  getSession,
  BETA_LICENSE_MONTHS,
  listApplications,
  openSigningLink,
  peekSigningLink,
  resendKeyLink,
  resume,
  revealKey,
  sign,
  SIGN_LINK_TTL_MS,
  signedPdfPath,
  type BetaDeps,
} from '@/lib/beta-access/service';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const key = { kid: 'test-1', privateKey: generateKeyPairSync('ed25519').privateKey };
const pub = { 'test-1': publicKeyFromRaw(rawPublicKey(key.privateKey)) };

let sent: Mail[];
let clock: Date;
let blob: BlobStore;
let failPut: ((path: string) => boolean) | null;
let deps: BetaDeps;

beforeEach(async () => {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, '../../../drizzle') });
  sent = [];
  clock = new Date('2026-11-02T09:00:00.000Z');
  failPut = null;
  const inner = memoryBlobStore();
  blob = {
    put: async (p, bytes, type) => {
      if (failPut?.(p)) throw new Error('simulated blob failure');
      return inner.put(p, bytes, type);
    },
    get: (p) => inner.get(p),
    del: (p) => inner.del(p),
  };
  deps = {
    db: db as unknown as Db,
    key,
    mailer: { send: async (m) => void sent.push(m) },
    downloadUrl: 'https://github.com/mgwedd/aletheia/releases/latest',
    siteUrl: 'https://astrealabs.test',
    now: () => clock,
    blob,
    sealer: devSealer(),
    reviewEmail: 'review@astrealabs.test',
  };
});

const advance = (ms: number) => (clock = new Date(clock.getTime() + ms));
const meta = { ip: '203.0.113.7', ua: 'Mozilla/5.0 (Macintosh) test' };

function input(over: { email?: string; fullName?: string; consents?: Record<string, string>; c11?: boolean } = {}) {
  const at = clock.toISOString();
  const consents = over.consents ?? Object.fromEntries([...REQUIRED_AT_APPLY, ...(over.c11 ? ['C11'] : [])].map((id) => [id, at]));
  return applicationInputSchema.parse({
    answers: {
      fullName: over.fullName ?? 'Jane Doe',
      email: over.email ?? 'Jane@Example.com',
      credential: 'lcsw',
      licenses: [{ state: 'WA', number: '12345' }],
      practiceName: 'Doe Therapy',
      setting: 'solo',
      clientStates: ['WA'],
      formats: ['video'],
      categories: ['minors'],
      mac: { chip: 'apple-silicon', macos: '26' },
    },
    consents,
  });
}

const signLinkIn = (m: Mail) => m.text.match(/\/aletheia\/beta\/sign\?t=([\w-]{43})/)![1];
const keyLinkIn = (m: Mail) => m.text.match(/\/aletheia\/beta\/key\?t=([\w-]{43})/)![1];
const lastTo = (to: string) => sent.filter((m) => m.to === to).at(-1)!;
const rows = (r: unknown) => (r as { rows: Record<string, unknown>[] }).rows;

/** apply -> open the emailed link -> view the PDF. Returns the session cookie value. */
async function readyToSign(over: Parameters<typeof input>[0] = {}) {
  expect(await apply(deps, input(over))).toBe('sent');
  advance(5 * MIN);
  const opened = await openSigningLink(deps, signLinkIn(sent.at(-1)!));
  if (!opened.ok) throw new Error(`open ${opened.reason}`);
  advance(MIN);
  const doc = await getDocument(deps, opened.sessionToken);
  expect(doc.ok).toBe(true);
  advance(2 * MIN);
  return opened.sessionToken;
}

async function signed(over: Parameters<typeof input>[0] = {}) {
  const session = await readyToSign(over);
  const r = await sign(deps, session, { name: over.fullName ?? 'Jane Doe', consentEsignAt: clock.toISOString() }, meta);
  if (!r.ok) throw new Error(`sign ${r.error}`);
  const [app] = await deps.db.select().from(betaApplications).where(eq(betaApplications.documentId, r.documentId));
  return { session, documentId: r.documentId, app };
}

const licenseCheck = { source: 'board' as const, result: 'Active, WA LICSW', checkedAt: '2026-11-02T10:00:00Z' };

describe('apply', () => {
  it('stores a draft and emails a signing link, not a key', async () => {
    expect(await apply(deps, input({ c11: true }))).toBe('sent');
    const [app] = await deps.db.select().from(betaApplications);
    expect(app).toMatchObject({ email: 'jane@example.com', status: 'draft', updatesOptIn: true, documentId: null });
    expect(app.consents.map((c) => c.id)).toEqual([...REQUIRED_AT_APPLY, 'C11']);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('jane@example.com');
    const t = signLinkIn(sent[0]);
    expect(app.signLinkHash).not.toContain(t);
    expect(await peekSigningLink(deps, t)).toBe('valid');
    expect(await peekSigningLink(deps, t)).toBe('valid'); // peeking doesn't consume
  });

  it('rejects consents ticked in the future or more than 24h ago', async () => {
    const all = (at: string) => Object.fromEntries(REQUIRED_AT_APPLY.map((id) => [id, at]));
    const future = await apply(deps, input({ consents: all(new Date(clock.getTime() + 2 * MIN).toISOString()) }));
    expect(future).toEqual({ invalid: expect.stringMatching(/future/) });
    const old = await apply(deps, input({ consents: all(new Date(clock.getTime() - 25 * HOUR).toISOString()) }));
    expect(old).toEqual({ invalid: expect.stringMatching(/too old/) });
    // Up to a minute of clock skew is fine.
    expect(await apply(deps, input({ consents: all(new Date(clock.getTime() + 30_000).toISOString()) }))).toBe('sent');
    expect(sent).toHaveLength(1);
  });

  it('re-applying with a draft replaces the answers and the old link', async () => {
    await apply(deps, input());
    const first = signLinkIn(sent[0]);
    advance(HOUR);
    expect(await apply(deps, input({ fullName: 'Jane Q. Doe' }))).toBe('sent');
    const apps = await deps.db.select().from(betaApplications);
    expect(apps).toHaveLength(1);
    expect((apps[0].answers as { fullName: string }).fullName).toBe('Jane Q. Doe');
    expect(await peekSigningLink(deps, first)).toBe('invalid');
    expect(await peekSigningLink(deps, signLinkIn(sent[1]))).toBe('valid');
  });

  it('sends nothing to an address whose application is already submitted', async () => {
    await signed();
    const before = sent.length;
    expect(await apply(deps, input())).toBe('exists');
    expect(sent).toHaveLength(before);
    expect(await deps.db.select().from(betaApplications)).toHaveLength(1);
  });

  it('rate-limits sign-link emails per address', async () => {
    let last;
    for (let i = 0; i < 10; i++) last = await apply(deps, input());
    expect(last).toBe('rate_limited');
    expect(sent.length).toBeLessThan(10);
  });
});

describe('resume', () => {
  it('issues a fresh link and retires the old one', async () => {
    await apply(deps, input());
    const first = signLinkIn(sent[0]);
    expect(await resume(deps, ' JANE@example.com ')).toBe('sent');
    expect(sent[1].subject).toBe(sent[0].subject);
    expect(await peekSigningLink(deps, first)).toBe('invalid');
    expect((await openSigningLink(deps, signLinkIn(sent[1]))).ok).toBe(true);
  });

  it('sends nothing without a draft, or once signed', async () => {
    expect(await resume(deps, 'nobody@example.com')).toBe('none');
    await signed();
    const before = sent.length;
    expect(await resume(deps, 'jane@example.com')).toBe('none');
    expect(sent).toHaveLength(before);
  });
});

describe('signing link', () => {
  it('works once', async () => {
    await apply(deps, input());
    const t = signLinkIn(sent[0]);
    expect((await openSigningLink(deps, t)).ok).toBe(true);
    expect(await openSigningLink(deps, t)).toEqual({ ok: false, reason: 'used' });
    expect(await peekSigningLink(deps, t)).toBe('used');
  });

  it('can be opened by only one of two concurrent requests, leaving one draft PDF', async () => {
    await apply(deps, input());
    const t = signLinkIn(sent[0]);
    const results = await Promise.all([openSigningLink(deps, t), openSigningLink(deps, t)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: 'used' }]);
    const [app] = await deps.db.select().from(betaApplications);
    expect(await blob.get(app.draftPdfPath!)).not.toBeNull();
    const winner = results.find((r) => r.ok)!;
    expect((await getSession(deps, winner.ok ? winner.sessionToken : undefined))?.kind).toBe('signing');
  });

  it('expires after 7 days', async () => {
    await apply(deps, input());
    advance(SIGN_LINK_TTL_MS + 1);
    const t = signLinkIn(sent[0]);
    expect(await peekSigningLink(deps, t)).toBe('expired');
    expect(await openSigningLink(deps, t)).toEqual({ ok: false, reason: 'expired' });
  });

  it('refuses unknown and malformed tokens', async () => {
    expect(await openSigningLink(deps, 'A'.repeat(43))).toEqual({ ok: false, reason: 'invalid' });
    expect(await openSigningLink(deps, 'nope')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('confirms the address and starts a 2h session that serves the draft', async () => {
    await apply(deps, input());
    advance(MIN);
    const opened = await openSigningLink(deps, signLinkIn(sent[0]));
    if (!opened.ok) throw new Error();
    expect(opened.expiresAt.getTime() - clock.getTime()).toBe(2 * HOUR);
    const [app] = await deps.db.select().from(betaApplications);
    expect(app.emailConfirmedAt).toEqual(clock);
    expect(app.documentCreatedAt).toEqual(clock);
    expect(app.draftPdfSha256).toBe(sha256Hex((await blob.get(app.draftPdfPath!))!));

    const doc = await getDocument(deps, opened.sessionToken);
    expect(doc.ok && doc.filename).toBe('aletheia-beta-application-2026-11-02.pdf');
    const [viewed] = await deps.db.select().from(betaApplications);
    expect(viewed.documentViewedAt).toEqual(clock);

    advance(2 * HOUR + 1);
    expect(await getSession(deps, opened.sessionToken)).toBeNull();
    expect(await getDocument(deps, opened.sessionToken)).toEqual({ ok: false, reason: 'session' });
  });
});

describe('sign', () => {
  it('stores the stamped PDF, audit JSON and evidence row, then marks the application submitted', async () => {
    const session = await readyToSign({ c11: false });
    const [draft] = await deps.db.select().from(betaApplications);
    const r = await sign(deps, session, { name: '  jane   DOE ', consentEsignAt: new Date(clock.getTime() - 10_000).toISOString() }, meta);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const [app] = await deps.db.select().from(betaApplications);
    expect(app).toMatchObject({ status: 'submitted', documentId: r.documentId });
    const [doc] = await deps.db.select().from(signedDocuments);
    expect(doc).toMatchObject({
      id: r.documentId,
      applicationId: app.id,
      signerEmail: 'jane@example.com',
      signerName: 'Jane Doe',
      typedSignature: 'jane DOE',
      signerIp: meta.ip,
      signerUa: meta.ua,
      unsignedSha256: draft.draftPdfSha256,
      pdfPath: signedPdfPath(r.documentId),
      auditPath: auditPath(r.documentId),
      sealAlg: 'Ed25519',
    });

    // Blobs present, hashes match, the draft is gone.
    const pdf = (await blob.get(doc.pdfPath))!;
    const auditBytes = (await blob.get(doc.auditPath))!;
    expect(sha256Hex(pdf)).toBe(doc.pdfSha256);
    expect(sha256Hex(auditBytes)).toBe(doc.auditSha256);
    expect(doc.pdfSha256).not.toBe(doc.unsignedSha256);
    expect(await blob.get(draft.draftPdfPath!)).toBeNull();

    // The seal verifies against the dev key.
    const ok = verify(null, Buffer.from(sealMessage(doc.id, doc.pdfSha256)), devPublicKey(), Buffer.from(doc.seal, 'base64'));
    expect(ok).toBe(true);

    // Audit events in order.
    const audit = JSON.parse(new TextDecoder().decode(auditBytes));
    expect(audit.events.map((e: { type: string }) => e.type)).toEqual([
      'document_created',
      'email_confirmed',
      'document_viewed',
      'consent_esign',
      'signed',
    ]);
    const times = audit.events.map((e: { at: string }) => Date.parse(e.at));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(audit).toMatchObject({ documentId: doc.id, pdfSha256: doc.pdfSha256, seal: { signature: doc.seal } });

    // Every consent block recorded; C12 at the e-sign time, unticked C11 blank.
    const blocks = new Map(doc.blocks.map((b) => [b.id, b.tickedAt]));
    expect(blocks.get('C12')).toBe(audit.events[3].at);
    expect(blocks.get('C11')).toBe('');
    expect(blocks.get('B1')).toBe(blocks.get('B0'));

    // Emails: received to the applicant, every answer to the reviewer, no attachments, no key.
    const received = lastTo('jane@example.com');
    expect(received.subject).toMatch(/received/i);
    const review = lastTo('review@astrealabs.test');
    expect(review.subject).not.toMatch(/jane/i);
    expect(review.text).toContain('Doe Therapy');
    expect(review.text).toContain(app.id);
    for (const m of sent) expect(Object.keys(m).sort()).toEqual(['html', 'subject', 'text', 'to']);
    expect((await deps.db.select().from(emailSends)).map((e) => e.kind)).toEqual(['sign-link', 'received']);

    // The session now serves the signed copy, checked against its hash.
    const served = await getDocument(deps, session);
    expect(served.ok && sha256Hex(served.bytes)).toBe(doc.pdfSha256);
  });

  it('skips the review email when BETA_REVIEW_EMAIL is unset', async () => {
    deps = { ...deps, reviewEmail: null };
    await signed();
    expect(sent.map((m) => m.to)).toEqual(['jane@example.com', 'jane@example.com']);
  });

  it('refuses a name that does not match A1', async () => {
    const session = await readyToSign();
    expect(await sign(deps, session, { name: 'John Doe', consentEsignAt: clock.toISOString() }, meta)).toEqual({
      ok: false,
      error: 'name_mismatch',
    });
    expect(await sign(deps, session, { name: '   ', consentEsignAt: clock.toISOString() }, meta)).toEqual({
      ok: false,
      error: 'name_mismatch',
    });
    expect((await deps.db.select().from(betaApplications))[0].status).toBe('draft');
    expect(await deps.db.select().from(signedDocuments)).toHaveLength(0);
  });

  it('refuses an e-sign consent time outside the session window', async () => {
    const session = await readyToSign();
    const at = (ms: number) => new Date(clock.getTime() + ms).toISOString();
    // readyToSign viewed the document 2 minutes ago; C12 can't predate that (beyond 1 min of skew).
    for (const consentEsignAt of [at(2 * MIN), at(-2 * HOUR - MIN), at(-3 * MIN - 1000), 'not a date']) {
      expect(await sign(deps, session, { name: 'Jane Doe', consentEsignAt }, meta)).toEqual({ ok: false, error: 'invalid' });
    }
  });

  it('requires the document to have been viewed', async () => {
    await apply(deps, input());
    const opened = await openSigningLink(deps, signLinkIn(sent[0]));
    if (!opened.ok) throw new Error();
    expect(await sign(deps, opened.sessionToken, { name: 'Jane Doe', consentEsignAt: clock.toISOString() }, meta)).toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('refuses without a valid session', async () => {
    expect(await sign(deps, undefined, { name: 'Jane Doe', consentEsignAt: clock.toISOString() }, meta)).toEqual({
      ok: false,
      error: 'session',
    });
  });

  it('stores one record when signed twice at once, and refuses a later sign', async () => {
    const session = await readyToSign();
    const body = { name: 'Jane Doe', consentEsignAt: clock.toISOString() };
    const results = await Promise.all([sign(deps, session, body, meta), sign(deps, session, body, meta)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: 'already_signed' });
    expect(await deps.db.select().from(signedDocuments)).toHaveLength(1);
    expect(await sign(deps, session, body, meta)).toEqual({ ok: false, error: 'already_signed' });
    // The loser's blobs were removed; only the winner's remain.
    const loser = (await deps.db.select().from(signedDocuments))[0].id;
    expect(await blob.get(signedPdfPath(loser))).not.toBeNull();
  });

  it('leaves nothing submitted when a blob write fails, and can be retried', async () => {
    const session = await readyToSign();
    const body = { name: 'Jane Doe', consentEsignAt: clock.toISOString() };
    failPut = (p) => p.endsWith('/audit.json');
    expect(await sign(deps, session, body, meta)).toEqual({ ok: false, error: 'store_failed' });
    const [app] = await deps.db.select().from(betaApplications);
    expect(app).toMatchObject({ status: 'draft', documentId: null });
    expect(await deps.db.select().from(signedDocuments)).toHaveLength(0);
    expect(sent.filter((m) => /received/i.test(m.subject))).toHaveLength(0);
    // The draft is still there to sign.
    expect(await blob.get(app.draftPdfPath!)).not.toBeNull();

    failPut = null;
    const r = await sign(deps, session, body, meta);
    expect(r.ok).toBe(true);
  });

  it('removes the signed PDF it wrote when the audit write fails', async () => {
    const session = await readyToSign();
    const written: string[] = [];
    const put = blob.put;
    blob.put = async (p, b, t) => {
      written.push(p);
      if (p.endsWith('/audit.json')) throw new Error('simulated');
      return put(p, b, t);
    };
    await sign(deps, session, { name: 'Jane Doe', consentEsignAt: clock.toISOString() }, meta);
    const pdfPath = written.find((p) => p.endsWith('/document.pdf'))!;
    expect(await blob.get(pdfPath)).toBeNull();
  });
});

describe('append-only evidence', () => {
  it('rejects UPDATE, DELETE and TRUNCATE on signed_documents and document_reviews', async () => {
    const { app } = await signed();
    await decline(deps, { applicationId: app.id, reviewer: 'mw' });
    for (const stmt of [
      sql`UPDATE signed_documents SET signer_name = 'X'`,
      sql`DELETE FROM signed_documents`,
      sql`TRUNCATE signed_documents CASCADE`,
      sql`UPDATE document_reviews SET reviewer = 'X'`,
      sql`DELETE FROM document_reviews`,
      sql`TRUNCATE document_reviews`,
    ]) {
      const err = await deps.db.execute(stmt).then(
        () => null,
        (e: Error & { cause?: Error }) => e,
      );
      expect(err?.cause?.message ?? err?.message).toMatch(/append-only: (UPDATE|DELETE|TRUNCATE) is not allowed/);
    }
    expect(await deps.db.select().from(signedDocuments)).toHaveLength(1);
    expect(await deps.db.select().from(documentReviews)).toHaveLength(1);
    expect(rows(await deps.db.execute(sql`SELECT signer_name FROM signed_documents`))[0].signer_name).toBe('Jane Doe');
  });
});

describe('approve', () => {
  it('records the review, issues a 6-month license and emails a key link that reveals it once', async () => {
    const { app, documentId } = await signed({ c11: true });
    advance(DAY);
    const r = await approve(deps, { applicationId: app.id, reviewer: 'mw', licenseCheck, notes: 'ok' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.emailed).toBe(true);
    expect(r.review).toMatchObject({ decision: 'approved', documentId, applicationId: app.id, lid: r.lid, reviewer: 'mw' });

    const [license] = await deps.db.select().from(licenses);
    expect(license).toMatchObject({ lid: r.lid, email: 'jane@example.com', updatesOptIn: true });
    expect(license.expiresAt).toEqual(addMonths(clock, BETA_LICENSE_MONTHS));
    const [after] = await deps.db.select().from(betaApplications);
    expect(after).toMatchObject({ status: 'approved', lid: r.lid });

    const mail = lastTo('jane@example.com');
    expect(mail.text + mail.html).not.toContain(LICENSE_PREFIX + '.');
    const link = keyLinkIn(mail);
    expect(await deps.db.select().from(keyLinks)).toHaveLength(1);

    advance(HOUR);
    const k = await revealKey(deps, link);
    if (!k.ok) throw new Error(k.reason);
    expect(verifyLicense(k.token, pub, Math.floor(clock.getTime() / 1000)).ok).toBe(true);
    expect(k).toMatchObject({ hasDocument: true, downloadUrl: deps.downloadUrl, expiresAt: license.expiresAt });
    // The key page's session serves the signed copy.
    expect((await getSession(deps, k.session!.token))?.kind).toBe('signed');
    expect((await getDocument(deps, k.session!.token)).ok).toBe(true);

    expect(await revealKey(deps, link)).toEqual({ ok: false, reason: 'used' });

    // A lost link: requestLicense (resend only) now sends a fresh one for this address.
    expect(await requestLicense(deps, { email: 'jane@example.com' })).toBe('resent');
    const again = await revealKey(deps, keyLinkIn(lastTo('jane@example.com')));
    expect(again.ok && again.token).toBe(k.token);
    // So does the admin key-link action.
    expect(await resendKeyLink(deps, r.lid!)).toBe('sent');
  });

  it('works only on a submitted application', async () => {
    await apply(deps, input());
    const [draft] = await deps.db.select().from(betaApplications);
    expect(await approve(deps, { applicationId: draft.id, reviewer: 'mw', licenseCheck })).toEqual({
      ok: false,
      error: 'not_submitted',
    });
    expect(await approve(deps, { applicationId: '00000000-0000-4000-8000-000000000000', reviewer: 'mw', licenseCheck })).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await deps.db.select().from(licenses)).toHaveLength(0);
  });

  it('cannot approve twice', async () => {
    const { app } = await signed();
    expect((await approve(deps, { applicationId: app.id, reviewer: 'mw', licenseCheck })).ok).toBe(true);
    expect(await approve(deps, { applicationId: app.id, reviewer: 'mw', licenseCheck })).toEqual({ ok: false, error: 'not_submitted' });
    expect(await deps.db.select().from(licenses)).toHaveLength(1);
    expect(await deps.db.select().from(documentReviews)).toHaveLength(1);
  });

  it('keeps the approval when the key email fails', async () => {
    const { app } = await signed();
    deps = { ...deps, mailer: { send: async () => Promise.reject(new Error('mail down')) } };
    const r = await approve(deps, { applicationId: app.id, reviewer: 'mw', licenseCheck });
    expect(r.ok && r.emailed).toBe(false);
    expect((await deps.db.select().from(betaApplications))[0].status).toBe('approved');
  });
});

describe('decline', () => {
  it('records the review and sends a neutral email with no license', async () => {
    const { app } = await signed();
    const r = await decline(deps, { applicationId: app.id, reviewer: 'mw', notes: 'out of scope' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r).toMatchObject({ lid: null, emailed: true, review: { decision: 'declined', licenseCheck: null } });
    expect((await deps.db.select().from(betaApplications))[0].status).toBe('declined');
    const mail = lastTo('jane@example.com');
    expect(mail.text).not.toContain('out of scope');
    expect(mail.text).not.toMatch(/key\?t=/);
    expect(await deps.db.select().from(licenses)).toHaveLength(0);
    expect(await approve(deps, { applicationId: app.id, reviewer: 'mw', licenseCheck })).toEqual({ ok: false, error: 'not_submitted' });
    // Re-applying after a decision sends nothing.
    advance(HOUR);
    const before = sent.length;
    expect(await apply(deps, input())).toBe('exists');
    expect(sent).toHaveLength(before);
  });
});

describe('admin reads', () => {
  it('lists and shows applications without link or session hashes', async () => {
    const { app } = await signed();
    await apply(deps, input({ email: 'other@example.com', fullName: 'Other Person' }));
    const all = await listApplications(deps);
    expect(all.map((a) => a.fullName).sort()).toEqual(['Jane Doe', 'Other Person']);
    expect((await listApplications(deps, 'submitted')).map((a) => a.id)).toEqual([app.id]);

    const found = await getApplication(deps, app.id);
    expect(found!.application).not.toHaveProperty('signLinkHash');
    expect(found!.application).not.toHaveProperty('sessionHash');
    expect(found!.document?.id).toBe(app.documentId);
    expect(found!.answers.length).toBeGreaterThan(5);
  });
});

describe('cleanupDrafts', () => {
  it('removes drafts older than 7 days with no live link or session, and their PDFs', async () => {
    await readyToSign({ email: 'stale@example.com' });
    const [stale] = await deps.db.select().from(betaApplications);
    await signed(); // jane: submitted, never cleaned
    advance(DAY);
    await apply(deps, input({ email: 'fresh@example.com' }));

    advance(6 * DAY + HOUR);
    // stale: 7d+ old, link used, session expired. fresh: 6d old.
    expect(await cleanupDrafts(deps)).toEqual({ deleted: 1 });
    expect(await blob.get(stale.draftPdfPath!)).toBeNull();
    const left = await deps.db.select().from(betaApplications);
    expect(left.map((a) => a.email).sort()).toEqual(['fresh@example.com', 'jane@example.com']);
    expect(await deps.db.select().from(signedDocuments)).toHaveLength(1);

    advance(DAY);
    expect(await cleanupDrafts(deps)).toEqual({ deleted: 1 });
    expect((await deps.db.select().from(betaApplications)).map((a) => a.status)).toEqual(['submitted']);
  });

  it('keeps an old draft whose new link is still live', async () => {
    await apply(deps, input());
    advance(8 * DAY);
    expect(await resume(deps, 'jane@example.com')).toBe('sent');
    expect(await cleanupDrafts(deps)).toEqual({ deleted: 0 });
  });
});
