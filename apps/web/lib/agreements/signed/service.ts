// Signed level: evidence blocks, stamping, sealing and storing a signed
// document for any signed-level definition. Server-only.
//
// The caller owns the flow around it (who the signer is, links, sessions) and
// passes a `claim`: an UPDATE ... RETURNING "id" on its own working state. The
// evidence row is inserted in the same statement, only if the claim matched,
// so a double submit stores one record.
import { randomUUID } from 'node:crypto';
import { eq, sql, type SQL } from 'drizzle-orm';
import { signedDocuments, type ConsentRecord, type SignatureBlock } from '@/lib/licensing/db/schema';
import type { Db } from '@/lib/licensing/service';
import type { AgreementDefinition } from '../define';
import { blockRecords, sha256Hex } from '../evidence';
import type { BlobStore } from './blob';
import { stampAndCertify, type AuditEvent, type AuditTrail } from './pdf';
import { sealMessage, type Sealer } from './seal';

export type SignedDeps = { db: Db; blob: BlobStore; sealer: Sealer };

const errType = (err: unknown) => (err instanceof Error ? err.name : typeof err);

const docType = (def: AgreementDefinition): string => {
  if (!def.document) throw new Error(`${def.id} is not a signed agreement`);
  return def.document.type;
};

export const draftPath = (def: AgreementDefinition, applicationId: string, sha: string) =>
  `${docType(def)}/drafts/${applicationId}/${sha}.pdf`;
export const signedPdfPath = (def: AgreementDefinition, documentId: string) =>
  `${docType(def)}/signed/${documentId}/document.pdf`;

/** Best effort: a failed delete only leaves an orphan blob (cleanup or manual). */
export async function tryDelete(blob: BlobStore, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (!list.length) return;
  try {
    await blob.del(list);
  } catch (err) {
    console.error('signed blob delete failed', errType(err));
  }
}

/** Block text changed (a new version shipped) since these were ticked. */
export function consentsAreStale(def: AgreementDefinition, consents: ConsentRecord[]): boolean {
  const current = new Map(blockRecords(def).map((b) => [b.id, b]));
  return consents.some((c) => {
    const b = current.get(c.id);
    return !b || b.sha256 !== c.sha256 || b.version !== c.version;
  });
}

/**
 * Every block as shown, for the evidence row. Terms are acknowledged by the
 * termsAckId tick, so they carry its time; an unticked optional box carries ''.
 */
export function signedBlocks(def: AgreementDefinition, consents: ConsentRecord[], signingConsentAt: string): ConsentRecord[] {
  const ticked = new Map(consents.map((c) => [c.id, c.tickedAt]));
  ticked.set(def.signingConsent!.id, signingConsentAt);
  const ack = ticked.get(def.document!.termsAckId) ?? '';
  const terms = new Set(def.terms.map((b) => b.id));
  return blockRecords(def).map((b) => ({ ...b, tickedAt: ticked.get(b.id) ?? (terms.has(b.id) ? ack : '') }));
}

export type SignInput = {
  definition: AgreementDefinition;
  applicationId: string;
  /** The unsigned PDF, already checked against unsignedSha256. */
  draft: Uint8Array;
  unsignedSha256: string;
  signatureBlock: SignatureBlock;
  signer: { name: string; email: string };
  /** The name as typed at signing. */
  typedName: string;
  /** Stored as-is on the evidence row. */
  answers: unknown;
  blocks: ConsentRecord[];
  emailConfirmedAt: Date;
  signedAt: Date;
  events: AuditEvent[];
  ip: string | null;
  ua: string | null;
  /** An UPDATE ... RETURNING "id" that claims the application for this documentId; the row is stored only if it returns one. */
  claim: (documentId: string) => SQL;
};

/** The step a failed attempt stopped at, for logs and the error shown to the signer. */
export type SignStep = 'stamp' | 'seal' | 'storage' | 'database';

export type SignResult =
  | { ok: true; documentId: string }
  | { ok: false; error: 'lost' }
  | { ok: false; error: 'store_failed'; step: SignStep };

/**
 * Stamps, seals and stores the signed document: the PDF in Blob, the evidence
 * row (with the signing events) in Postgres. The PDF path is keyed by a
 * documentId made for this attempt, and the row is inserted last, with the
 * claim. Any failure leaves nothing stored; the attempt's PDF is then deleted
 * (best effort). 'lost': the claim didn't match (another attempt won).
 */
export async function signAndStore(deps: SignedDeps, input: SignInput): Promise<SignResult> {
  const def = input.definition;
  const type = docType(def);
  const now = input.signedAt;
  const documentId = randomUUID();
  const pdfPath = signedPdfPath(def, documentId);
  const { ip, ua } = input;
  const audit: AuditTrail = {
    docType: type,
    docVersion: def.version,
    documentId,
    applicationId: input.applicationId,
    signerName: input.signer.name,
    signerEmail: input.signer.email,
    unsignedSha256: input.unsignedSha256,
    events: input.events,
    signerIp: ip,
    signerUa: ua,
  };

  let stored = false;
  let step: SignStep = 'stamp';
  try {
    const signed = await stampAndCertify(def, input.draft, {
      signatureBlock: input.signatureBlock,
      signerName: input.typedName,
      signedAt: now,
      audit,
    });
    const pdfSha256 = sha256Hex(signed);
    step = 'seal';
    const seal = await deps.sealer.seal(sealMessage(documentId, pdfSha256));

    step = 'storage';
    await deps.blob.put(pdfPath, signed, 'application/pdf');

    step = 'database';
    const res = await deps.db.execute(sql`
      WITH claimed AS (${input.claim(documentId)})
      INSERT INTO ${signedDocuments} (
        "id", "doc_type", "doc_version", "application_id", "signer_email", "signer_name", "answers", "blocks",
        "typed_signature", "email_confirmed_at", "signed_at", "signer_ip", "signer_ua", "unsigned_sha256",
        "pdf_path", "pdf_sha256", "events", "seal_alg", "seal_key_id", "seal_fingerprint",
        "seal", "created_at"
      )
      SELECT
        ${documentId}::uuid, ${type}, ${def.version}, "id", ${input.signer.email}, ${input.signer.name},
        ${JSON.stringify(input.answers)}::jsonb, ${JSON.stringify(input.blocks)}::jsonb,
        ${input.typedName}, ${input.emailConfirmedAt.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz,
        ${ip}, ${ua}, ${input.unsignedSha256},
        ${pdfPath}, ${pdfSha256}, ${JSON.stringify(input.events)}::jsonb, ${seal.alg}, ${seal.keyId}, ${seal.fingerprint},
        ${seal.signature}, ${now.toISOString()}::timestamptz
      FROM claimed
      RETURNING "id"`);
    stored = (res as unknown as { rows: unknown[] }).rows.length === 1;
  } catch (err) {
    console.error(`signed: store failed at ${step}`, errType(err));
    // The statement may have committed before the error reached us (e.g. a
    // dropped HTTP response): never delete the blobs of a stored record.
    const committed = await deps.db
      .select({ id: signedDocuments.id })
      .from(signedDocuments)
      .where(eq(signedDocuments.id, documentId))
      .limit(1)
      .then((r) => (r.length === 1 ? 'yes' : 'no'))
      .catch(() => 'unknown' as const);
    // Unknown: keep the blobs (an orphan is better than a record without its PDF).
    if (committed === 'no') await tryDelete(deps.blob, [pdfPath]);
    if (committed !== 'yes') return { ok: false, error: 'store_failed', step };
    stored = true;
  }
  if (!stored) {
    await tryDelete(deps.blob, [pdfPath]);
    return { ok: false, error: 'lost' };
  }
  return { ok: true, documentId };
}
