// One agreement definition, two levels.
//
//   accept: terms text + version, one or more unticked boxes, an accept button.
//           Evidence row, no PDF.
//   signed: adds consent to electronic records, a typed-name signature and a
//           sealed PDF emailed to the signer. `signingConsent` is the box ticked
//           at the signature step; `document` lays out the PDF. The PDF, seal
//           and evidence row come from lib/agreements/signed.
//
// Every `text` is SHA-256 hashed as evidence of what the person saw, so ANY
// CHANGE TO ANY TEXT MUST BUMP `version`.
//
// Client-safe: no node imports.

export type AgreementLevel = 'accept' | 'signed';

/** A piece of text the person reads or ticks. `text` may use **bold** and *italic* markers. */
export type Block = { id: string; title?: string; text: string; optional?: boolean };

export type AgreementDefinition = {
  /** Stable id, e.g. "aletheia-beta". Stored on every evidence row. */
  id: string;
  /** Bump on any text change. */
  version: string;
  level: AgreementLevel;
  title: string;
  /** Read-only text shown before the boxes, in order. */
  terms: Block[];
  /** Each one its own unticked box. Required unless `optional`. */
  checkboxes: Block[];
  /** signed only: consent to sign electronically, ticked at the signature step. Last in the document. */
  signingConsent?: Block;
  /** signed only: how the signed PDF is laid out and filed. */
  document?: SignedDocumentSpec;
};

/** The signed PDF's own wording. Block text is in the definition; this is the frame around it. */
export type SignedDocumentSpec = {
  /** Stored as doc_type on evidence rows, in the PDF and the audit trail. Also the blob path prefix. */
  type: string;
  /** PDF title, also used in page footers. */
  title: string;
  /** Short note under the header block. */
  intro: string;
  /** Heading over the signer's details (the caller's answers). */
  detailsHeading: string;
  /** Section heading by the first letter of a block id. `titleLine`: the block title gets its own line. */
  sections: Record<string, { heading: string; titleLine?: boolean }>;
  signatureHeading: string;
  /** Label over the typed-name box. */
  signatureLabel: string;
  /** Certificate labels for the signer's name and email. */
  signerNameLabel: string;
  signerEmailLabel: string;
  /** The checkbox that acknowledges the terms: terms blocks are recorded with its tick time. */
  termsAckId: string;
};

export function defineAgreement<const D extends AgreementDefinition>(def: D): D {
  const ids = [...def.terms, ...def.checkboxes, ...(def.signingConsent ? [def.signingConsent] : [])].map((b) => b.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new Error(`${def.id}: duplicate block id ${dup}`);
  if (def.checkboxes.length === 0) throw new Error(`${def.id}: needs at least one checkbox`);
  if (!def.checkboxes.some((b) => !b.optional)) throw new Error(`${def.id}: needs at least one required checkbox`);
  if (def.level === 'signed' && !def.signingConsent) throw new Error(`${def.id}: a signed agreement needs a signing consent`);
  if (def.level === 'signed' && !def.document) throw new Error(`${def.id}: a signed agreement needs a document`);
  if (def.document && !def.checkboxes.some((b) => b.id === def.document!.termsAckId)) {
    throw new Error(`${def.id}: termsAckId must be a checkbox`);
  }
  if (def.level === 'accept' && (def.signingConsent || def.document)) {
    throw new Error(`${def.id}: a simple accept has no signing consent or document`);
  }
  return def;
}

/** Every block, in document order: terms, boxes, then the signing consent. */
export const allBlocks = (def: AgreementDefinition): Block[] => [
  ...def.terms,
  ...def.checkboxes,
  ...(def.signingConsent ? [def.signingConsent] : []),
];

export const requiredCheckboxIds = (def: AgreementDefinition): string[] =>
  def.checkboxes.filter((b) => !b.optional).map((b) => b.id);

export const optionalCheckboxIds = (def: AgreementDefinition): string[] =>
  def.checkboxes.filter((b) => b.optional).map((b) => b.id);
