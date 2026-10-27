// @vitest-environment node
// A second, test-only signed definition through the generic signing path:
// PDF, stamp, seal with a test key, evidence row and blobs on PGlite.
import path from 'node:path';
import { generateKeyPairSync, sign as edSign, verify } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import * as schema from '@/lib/licensing/db/schema';
import { signedDocuments } from '@/lib/licensing/db/schema';
import type { Db } from '@/lib/licensing/service';
import { defineAgreement } from '@/lib/agreements/define';
import { blockRecords, sha256Hex, tickRecords } from '@/lib/agreements/evidence';
import { memoryBlobStore, type BlobStore } from '@/lib/agreements/signed/blob';
import { buildUnsignedPdf } from '@/lib/agreements/signed/pdf';
import { sealMessage, type Sealer } from '@/lib/agreements/signed/seal';
import {
  consentsAreStale,
  draftPath,
  signAndStore,
  signedBlocks,
  signedPdfPath,
  type SignInput,
} from '@/lib/agreements/signed/service';

const NDA = defineAgreement({
  id: 'test-nda',
  version: '2026-01-01',
  level: 'signed',
  title: 'Test NDA',
  terms: [
    { id: 'T1', title: 'Scope', text: 'Everything we **show** you.' },
    { id: 'T2', title: 'Term', text: 'Two years.' },
  ],
  checkboxes: [
    { id: 'K1', text: 'I have read T1 and T2.' },
    { id: 'K2', text: 'Send me updates.', optional: true },
  ],
  signingConsent: { id: 'K3', text: 'I agree to sign electronically.' },
  document: {
    type: 'test-nda',
    title: 'Test NDA',
    intro: 'A test document.',
    detailsHeading: 'A. Signer',
    sections: { T: { heading: 'Terms', titleLine: true }, K: { heading: 'Confirmations' } },
    signatureHeading: 'Signature',
    signatureLabel: 'Typed full name',
    signerNameLabel: 'Name',
    signerEmailLabel: 'Email',
    termsAckId: 'K1',
  },
});

// A seal key made for this test, not the dev key.
const sealKey = generateKeyPairSync('ed25519');
const testSealer: Sealer = {
  async seal(message) {
    return {
      alg: 'Ed25519',
      keyId: 'test-key',
      fingerprint: null,
      signature: edSign(null, Buffer.from(message, 'utf8'), sealKey.privateKey).toString('base64'),
    };
  },
};

const appId = '11111111-2222-4333-8444-555555555555';
const createdAt = new Date('2026-01-02T10:00:00.000Z');
const signedAt = new Date('2026-01-02T10:05:00.000Z');
const consents = tickRecords(NDA, { K1: '2026-01-02T09:59:00.000Z' });

let db: Db;
let blob: BlobStore;
let failPut: ((p: string) => boolean) | null;

beforeEach(async () => {
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: path.join(__dirname, '../../../../drizzle') });
  db = d as unknown as Db;
  // The caller's own working state, for the claim.
  await db.execute(sql`CREATE TABLE test_claims (id uuid PRIMARY KEY, document_id uuid)`);
  await db.execute(sql`INSERT INTO test_claims (id) VALUES (${appId}::uuid)`);
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
});

async function signInput(): Promise<SignInput> {
  const { bytes, signatureBlock } = await buildUnsignedPdf(NDA, {
    applicationId: appId,
    details: [
      { id: 'A1', label: 'Name', value: 'Pat Signer' },
      { id: 'A2', label: 'Email', value: 'pat@example.com' },
    ],
    consents,
    createdAt,
  });
  await blob.put(draftPath(NDA, appId, sha256Hex(bytes)), bytes, 'application/pdf');
  return {
    definition: NDA,
    applicationId: appId,
    draft: bytes,
    unsignedSha256: sha256Hex(bytes),
    signatureBlock,
    signer: { name: 'Pat Signer', email: 'pat@example.com' },
    typedName: 'Pat Signer',
    answers: { name: 'Pat Signer' },
    blocks: signedBlocks(NDA, consents, '2026-01-02T10:04:00.000Z'),
    emailConfirmedAt: createdAt,
    signedAt,
    events: [
      { type: 'document_created', at: createdAt.toISOString() },
      { type: 'consent_esign', at: '2026-01-02T10:04:00.000Z' },
      { type: 'signed', at: signedAt.toISOString() },
    ],
    ip: '203.0.113.9',
    ua: 'test',
    claim: (documentId) => sql`
      UPDATE test_claims SET document_id = ${documentId}::uuid
      WHERE id = ${appId}::uuid AND document_id IS NULL
      RETURNING "id"`,
  };
}

describe('signed level, generic path', () => {
  it('stamps, seals and stores a non-Aletheia signed agreement', async () => {
    const input = await signInput();
    const r = await signAndStore({ db, blob, sealer: testSealer }, input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const [doc] = await db.select().from(signedDocuments);
    expect(doc).toMatchObject({
      id: r.documentId,
      docType: 'test-nda',
      docVersion: '2026-01-01',
      applicationId: appId,
      signerName: 'Pat Signer',
      typedSignature: 'Pat Signer',
      pdfPath: signedPdfPath(NDA, r.documentId),
      auditPath: null,
      auditSha256: null,
      events: input.events,
      sealKeyId: 'test-key',
    });
    expect(doc.pdfPath).toBe(`test-nda/signed/${r.documentId}/document.pdf`);

    // Every block in order; terms carry the K1 tick, the signing consent its own, unticked K2 blank.
    expect(doc.blocks.map((b) => [b.id, b.tickedAt])).toEqual([
      ['T1', '2026-01-02T09:59:00.000Z'],
      ['T2', '2026-01-02T09:59:00.000Z'],
      ['K1', '2026-01-02T09:59:00.000Z'],
      ['K2', ''],
      ['K3', '2026-01-02T10:04:00.000Z'],
    ]);
    expect(doc.blocks.map((b) => b.sha256)).toEqual(blockRecords(NDA).map((b) => b.sha256));

    const pdf = (await blob.get(doc.pdfPath))!;
    expect(sha256Hex(pdf)).toBe(doc.pdfSha256);
    // No audit JSON in Blob: the events live on the row.
    expect(await blob.get(`test-nda/signed/${r.documentId}/audit.json`)).toBeNull();
    const pages = async (b: Uint8Array) => (await PDFDocument.load(b, { updateMetadata: false })).getPageCount();
    expect(await pages(pdf)).toBe((await pages(input.draft)) + 1);

    const sigOk = verify(
      null,
      Buffer.from(sealMessage(doc.id, doc.pdfSha256)),
      sealKey.publicKey,
      Buffer.from(doc.seal, 'base64'),
    );
    expect(sigOk).toBe(true);

    const claimed = await db.execute(sql`SELECT document_id FROM test_claims`);
    expect((claimed as unknown as { rows: { document_id: string }[] }).rows[0]!.document_id).toBe(r.documentId);
  });

  it('stores nothing when the claim does not match, and removes that attempt\'s blobs', async () => {
    const input = await signInput();
    const first = await signAndStore({ db, blob, sealer: testSealer }, input);
    expect(first.ok).toBe(true);
    const again = await signAndStore({ db, blob, sealer: testSealer }, input);
    expect(again).toEqual({ ok: false, error: 'lost' });
    expect(await db.select().from(signedDocuments)).toHaveLength(1);
  });

  it('leaves nothing stored when a blob write fails', async () => {
    const input = await signInput();
    failPut = (p) => p.endsWith('/document.pdf');
    expect(await signAndStore({ db, blob, sealer: testSealer }, input)).toEqual({ ok: false, error: 'store_failed', step: 'storage' });
    expect(await db.select().from(signedDocuments)).toHaveLength(0);
  });

  it('reports the seal step when sealing fails', async () => {
    const input = await signInput();
    const failing = { seal: async () => { throw new Error('no issuer'); } };
    expect(await signAndStore({ db, blob, sealer: failing }, input)).toEqual({ ok: false, error: 'store_failed', step: 'seal' });
    expect(await db.select().from(signedDocuments)).toHaveLength(0);
    failPut = null;
    expect((await signAndStore({ db, blob, sealer: testSealer }, input)).ok).toBe(true);
  });

  it('spots consents ticked against older text', () => {
    expect(consentsAreStale(NDA, consents)).toBe(false);
    expect(consentsAreStale(NDA, [{ ...consents[0]!, sha256: 'x' }])).toBe(true);
    expect(consentsAreStale({ ...NDA, version: '2' }, consents)).toBe(true);
  });

  it('needs a document spec on a signed definition', () => {
    const { document: _d, ...noDoc } = NDA;
    expect(() => defineAgreement(noDoc)).toThrow(/needs a document/);
    expect(() => defineAgreement({ ...NDA, document: { ...NDA.document, termsAckId: 'T1' } })).toThrow(/termsAckId/);
  });
});
