// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { answersSchema, describeAnswers } from '@/lib/beta-access/answers';
import { betaAgreement, REQUIRED_AT_APPLY } from '@/lib/beta-access/content';
import { consentRecords, sha256Hex } from '@/lib/beta-access/hash';
import { buildUnsignedPdf, stampAndCertify, type AuditTrail } from '@/lib/agreements/signed/pdf';

const answers = answersSchema.parse({
  fullName: 'Jordan Q. Example',
  email: 'jordan.example@example-practice.com',
  credential: 'pre-licensed',
  licenses: [{ state: 'CA', number: 'LMFT 123456' }],
  npi: '1234567890',
  supervisor: { name: 'Dr. Sam Supervisor', license: 'PSY 98765' },
  practiceName: 'Example Counseling — Telehealth',
  setting: 'group',
  clientStates: ['CA'],
  formats: ['video'],
  categories: ['minors'],
  mac: { chip: 'apple-silicon', macos: '26' },
  heardFrom: 'A colleague',
  notes: 'Unicode: “quotes”, émigré, ✓ → ok',
});
const ticked = Object.fromEntries(
  REQUIRED_AT_APPLY.map((id, i) => [id, new Date(Date.UTC(2026, 9, 23, 14, 2, i)).toISOString()]),
);
const ALETHEIA_BETA = betaAgreement('2026-10-24');
const applicationId = '7f1d2c3b-0000-4000-8000-123456789abc';
const createdAt = new Date('2026-10-23T14:10:00.000Z');
const signedAt = new Date('2026-10-23T15:30:12.345Z');

const details = describeAnswers(answers);
const build = () => buildUnsignedPdf(ALETHEIA_BETA, { applicationId, details, consents: consentRecords(ticked, '2026-10-24'), createdAt });

const audit = (unsignedSha256: string): AuditTrail => ({
  docType: 'beta-access',
  docVersion: '2026-10-23-draft.2',
  documentId: '0d9e8f7a-1111-4222-8333-444455556666',
  applicationId,
  signerName: answers.fullName,
  signerEmail: answers.email,
  unsignedSha256,
  events: [
    { type: 'document_created', at: createdAt.toISOString() },
    { type: 'signed', at: signedAt.toISOString() },
  ],
  signerIp: null,
  signerUa: null,
});

describe('buildUnsignedPdf', () => {
  it('is byte-for-byte deterministic for the same input', async () => {
    const a = await build();
    const b = await build();
    expect(sha256Hex(a.bytes)).toBe(sha256Hex(b.bytes));
    expect(a.signatureBlock).toEqual(b.signatureBlock);
  });

  it('changes when the input changes', async () => {
    const a = await build();
    const b = await buildUnsignedPdf(ALETHEIA_BETA, { applicationId, details, consents: consentRecords(ticked, '2026-10-24'), createdAt: signedAt });
    expect(sha256Hex(a.bytes)).not.toBe(sha256Hex(b.bytes));
  });

  it('places the signature block on a real page, inside it', async () => {
    const { bytes, signatureBlock: sb } = await build();
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(sb.page).toBeGreaterThanOrEqual(0);
    expect(sb.page).toBeLessThan(doc.getPageCount());
    const { width, height } = doc.getPage(sb.page).getSize();
    for (const p of [sb.name, sb.date, sb.consent]) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(width);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(height);
    }
    expect(doc.getCreationDate()?.toISOString()).toBe(createdAt.toISOString());
  });
});

describe('stampAndCertify', () => {
  it('parses with pdf-lib, appends one certificate page, and is deterministic', async () => {
    const { bytes, signatureBlock } = await build();
    const input = { signatureBlock, signerName: answers.fullName, signedAt, audit: audit(sha256Hex(bytes)) };
    const signed = await stampAndCertify(ALETHEIA_BETA, bytes, input);
    const again = await stampAndCertify(ALETHEIA_BETA, bytes, input);
    expect(sha256Hex(signed)).toBe(sha256Hex(again));

    const before = await PDFDocument.load(bytes, { updateMetadata: false });
    const after = await PDFDocument.load(signed, { updateMetadata: false });
    expect(after.getPageCount()).toBe(before.getPageCount() + 1);
    expect(after.getModificationDate()?.toISOString()).toBe('2026-10-23T15:30:12.000Z'); // PDF dates have second precision
    expect(sha256Hex(signed)).not.toBe(sha256Hex(bytes));
  });

  it('copes with a very long signer name', async () => {
    const { bytes, signatureBlock } = await build();
    const name = 'Maximiliana Alexandra Konstantinopoulou-Hernández de la Vega '.repeat(4);
    const signed = await stampAndCertify(ALETHEIA_BETA, bytes, {
      signatureBlock,
      signerName: name,
      signedAt,
      audit: { ...audit(sha256Hex(bytes)), signerName: name },
    });
    expect((await PDFDocument.load(signed, { updateMetadata: false })).getPageCount()).toBeGreaterThan((await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount());
  });
});

// A change here means the Aletheia PDF changed: bump DOC_VERSION, then update.
// Fixed at terms version 2026-10-24, which C1 names.
describe('Aletheia PDF output', () => {
  it('is unchanged byte for byte', async () => {
    const withC11 = { ...ticked, C11: new Date(Date.UTC(2026, 9, 23, 14, 2, 11)).toISOString() };
    const u = await buildUnsignedPdf(ALETHEIA_BETA, { applicationId, details, consents: consentRecords(withC11, '2026-10-24'), createdAt });
    expect(sha256Hex(u.bytes)).toBe('1fc53b8901eeff3a200c7c86da114259ebdbdfd8c687d7f4fc83d426f769d997');
    expect(u.signatureBlock).toEqual({
      page: 4,
      name: { x: 62, y: 384.66 },
      date: { x: 62, y: 333.93 },
      consent: { x: 84, y: 465.43, size: 9 },
    });
    const at = (d: Date) => d.toISOString();
    const signed = await stampAndCertify(ALETHEIA_BETA, u.bytes, {
      signatureBlock: u.signatureBlock,
      signerName: answers.fullName,
      signedAt,
      audit: {
        ...audit(sha256Hex(u.bytes)),
        events: [
          { type: 'document_created', at: at(createdAt) },
          { type: 'email_confirmed', at: at(createdAt) },
          { type: 'document_viewed', at: at(createdAt) },
          { type: 'consent_esign', at: at(signedAt) },
          { type: 'signed', at: at(signedAt) },
        ],
        signerIp: '203.0.113.7',
        signerUa: 'UA',
      },
    });
    expect(sha256Hex(signed)).toBe('02ce1ce230ff7e86ac34fd6f79947b92931136d81b8151f1a680f70395f50d94');
  });
});
