import { boolean, index, jsonb, pgTable, serial, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { AuditEvent } from '../../agreements/signed/pdf';

// Licensing stores no IP addresses, device IDs or install counts, by design.
// The one exception is signed_documents: IP and user agent at signing, as
// e-signature evidence (spec section E).

export const licenses = pgTable(
  'licenses',
  {
    lid: uuid('lid').primaryKey(),
    email: text('email').notNull(), // lowercased
    tier: text('tier').notNull().default('beta'),
    kid: text('kid').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(), // token iat
    expiresAt: timestamp('expires_at', { withTimezone: true }), // token exp; null = never expires
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
    revokedBy: text('revoked_by'), // who revoked it, as given to the admin API
    replacedBy: uuid('replaced_by'), // lid of the license that superseded this one
    renewalSentAt: timestamp('renewal_sent_at', { withTimezone: true }),
    // Renewals: the key is shown only after the licensee confirms C2 again.
    attestationRequired: boolean('attestation_required').notNull().default(false),
    attestedAt: timestamp('attested_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('licenses_email_idx').on(t.email), index('licenses_expires_at_idx').on(t.expiresAt)],
);

// One row per email sent, licensing and beta access alike. Used for
// per-address rate limits on the emails a visitor can trigger.
export const emailSends = pgTable(
  'email_sends',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    kind: text('kind', {
      enum: ['issue', 'resend', 'renewal', 'reissue', 'sign-link', 'key-link', 'received', 'decline', 'account-invite'],
    }).notNull(),
    lid: uuid('lid'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('email_sends_email_sent_at_idx').on(t.email, t.sentAt)],
);

// Short-lived test licenses the owner keeps on hand to try new builds
// (lib/licensing/test-license.ts). At most a few are live; a row is deleted once
// its license expires, so nothing accumulates. The token is rebuilt from the row.
export const testLicenses = pgTable('test_licenses', {
  lid: text('lid').primaryKey(), // "test-<uuid>"
  label: text('label').notNull(),
  kid: text('kid').notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(), // token iat
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // token exp
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdBy: text('created_by').notNull(),
});

export type TestLicense = typeof testLicenses.$inferSelect;

export type License = typeof licenses.$inferSelect;

// ---- Beta access applications and signed documents ----

/** One consent as ticked: text version, SHA-256 of the exact text, when ticked (ISO, UTC). */
export type ConsentRecord = { id: string; version: string; sha256: string; tickedAt: string };

/** A document the applicant accepted at the C1 tick: which one, its version, and the SHA-256 of its exact bytes. */
export type AcceptedDoc = { d: 'terms' | 'privacy'; v: string; h: string };

/** Where the empty signature block sits in the unsigned PDF, so signing can stamp it. */
export type SignatureBlock = {
  page: number;
  name: { x: number; y: number };
  date: { x: number; y: number };
  consent: { x: number; y: number; size: number };
};

// Working state of an application. Mutable. The evidence lives in
// signed_documents and document_reviews, which are append-only.
export const betaApplications = pgTable(
  'beta_applications',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(), // lowercased
    answers: jsonb('answers').notNull(),
    consents: jsonb('consents').$type<ConsentRecord[]>().notNull(),
    // The terms and privacy documents as they were when C1 was ticked. Null on
    // applications from before this was recorded.
    acceptedDocs: jsonb('accepted_docs').$type<AcceptedDoc[]>(),
    status: text('status', { enum: ['draft', 'submitted', 'approved', 'declined'] }).notNull().default('draft'),
    // Signing link (single use). Only its SHA-256 is stored.
    signLinkHash: text('sign_link_hash'),
    signLinkExpiresAt: timestamp('sign_link_expires_at', { withTimezone: true }),
    signLinkUsedAt: timestamp('sign_link_used_at', { withTimezone: true }),
    // Signing session, set when the link is opened. Only its SHA-256 is stored.
    sessionHash: text('session_hash'),
    sessionExpiresAt: timestamp('session_expires_at', { withTimezone: true }),
    emailConfirmedAt: timestamp('email_confirmed_at', { withTimezone: true }),
    // The unsigned PDF shown for signing.
    draftPdfPath: text('draft_pdf_path'),
    draftPdfSha256: text('draft_pdf_sha256'),
    signatureBlock: jsonb('signature_block').$type<SignatureBlock>(),
    documentCreatedAt: timestamp('document_created_at', { withTimezone: true }),
    documentViewedAt: timestamp('document_viewed_at', { withTimezone: true }),
    documentId: uuid('document_id'), // signed_documents.id once signed
    lid: uuid('lid'), // licenses.lid once approved
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('beta_applications_email_idx').on(t.email),
    uniqueIndex('beta_applications_sign_link_idx').on(t.signLinkHash),
    uniqueIndex('beta_applications_session_idx').on(t.sessionHash),
  ],
);

// The evidence record. Append-only: a database trigger rejects UPDATE and
// DELETE. A correction is a new row whose supersedes points at the old one.
export const signedDocuments = pgTable(
  'signed_documents',
  {
    id: uuid('id').primaryKey(),
    docType: text('doc_type').notNull(), // 'beta-access'
    docVersion: text('doc_version').notNull(),
    applicationId: uuid('application_id'),
    signerEmail: text('signer_email').notNull(),
    signerName: text('signer_name').notNull(),
    answers: jsonb('answers').notNull(),
    blocks: jsonb('blocks').$type<ConsentRecord[]>().notNull(), // every disclosure and attestation as shown
    typedSignature: text('typed_signature').notNull(),
    emailConfirmedAt: timestamp('email_confirmed_at', { withTimezone: true }).notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true }).notNull(),
    signerIp: text('signer_ip'),
    signerUa: text('signer_ua'),
    unsignedSha256: text('unsigned_sha256').notNull(),
    pdfPath: text('pdf_path').notNull(),
    pdfSha256: text('pdf_sha256').notNull(),
    // The signing events. Null on rows signed before they were stored here;
    // those keep them in the audit JSON at audit_path.
    events: jsonb('events').$type<AuditEvent[]>(),
    // Audit JSON in Blob: only on rows signed before events moved to this table.
    auditPath: text('audit_path'),
    auditSha256: text('audit_sha256'),
    sealAlg: text('seal_alg').notNull(),
    sealKeyId: text('seal_key_id').notNull(),
    sealFingerprint: text('seal_fingerprint'),
    seal: text('seal').notNull(), // base64
    supersedes: uuid('supersedes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('signed_documents_signer_idx').on(t.docType, t.signerEmail),
    index('signed_documents_application_idx').on(t.applicationId),
  ],
);

export type LicenseCheck = { source: 'board' | 'nppes'; result: string; checkedAt: string };

// Review decisions (spec section E). Append-only, like signed_documents.
export const documentReviews = pgTable(
  'document_reviews',
  {
    id: uuid('id').primaryKey(),
    documentId: uuid('document_id').notNull(),
    applicationId: uuid('application_id').notNull(),
    reviewer: text('reviewer').notNull(),
    decision: text('decision', { enum: ['approved', 'declined'] }).notNull(),
    licenseCheck: jsonb('license_check').$type<LicenseCheck>(),
    notes: text('notes'),
    lid: uuid('lid'),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('document_reviews_document_idx').on(t.documentId)],
);

// Single-use, expiring links to the page that shows a license key.
export const keyLinks = pgTable('key_links', {
  id: uuid('id').primaryKey(),
  lid: uuid('lid').notNull(),
  applicationId: uuid('application_id'),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BetaApplication = typeof betaApplications.$inferSelect;
export type SignedDocument = typeof signedDocuments.$inferSelect;
export type DocumentReview = typeof documentReviews.$inferSelect;

// ---- Account invites ----

// One row per invitation to create an account. Created only for an email
// confirmed through a beta application. The token is single use, expires, and
// only its SHA-256 is stored. The account is created for `email` and no other.
export const accountInvites = pgTable(
  'account_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(), // lowercased
    applicationId: uuid('application_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('account_invites_token_hash_idx').on(t.tokenHash), index('account_invites_email_idx').on(t.email)],
);
