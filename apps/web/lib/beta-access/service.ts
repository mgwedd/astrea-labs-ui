// Aletheia beta access: apply, confirm email, sign, review, key delivery.
//
// Flow: apply (answers + consents) -> email a single-use signing link (7 days)
// -> opening it (a POST) confirms the address, starts a 2h signing session and
// builds the unsigned PDF -> the applicant views it, ticks C12, types their
// name and signs -> the server stamps, seals and stores the signed PDF and
// the evidence row (with the signing events); only then is the application "submitted"
// -> an admin approves (license + key link) or declines.
//
// Secrets (sign links, sessions, key links) are 32 random bytes, base64url.
// Only their SHA-256 is stored and lookups go by the hash. Single use is a
// conditional UPDATE ... WHERE used_at IS NULL AND expires_at > now RETURNING,
// so two concurrent requests can't both win.
//
// Never log answers, emails or tokens: errors are logged by type only.
import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import {
  betaApplications,
  documentReviews,
  emailSends,
  signedDocuments,
  type BetaApplication,
  type DocumentReview,
  type LicenseCheck,
  type SignedDocument,
} from '../licensing/db/schema';
import {
  hashLinkToken,
  addMonths,
  isRateLimited,
  issueLicense,
  looksLikeLinkToken,
  newLinkToken,
  normalizeEmail,
  revealKeyLink,
  sendKeyLink,
  type Deps,
} from '../licensing/service';
import { emailOutbox } from '../email/db/schema';
import { licenses } from '../licensing/db/schema';
import type { BlobStore } from '../agreements/signed/blob';
import { buildUnsignedPdf, type AuditEvent, type AuditTrail } from '../agreements/signed/pdf';
import type { Seal, Sealer } from '../agreements/signed/seal';
import * as signed from '../agreements/signed/service';
import { describeAnswers, type Answers, type ApplicationInput } from './answers';
import { acceptAgreement, type Db as AgreementsDb } from '../agreements/service';
import { ALETHEIA_RENEWAL, BETA_FRAME, REQUIRED_AT_APPLY, betaAgreement } from './content';
import type { LegalDocs } from '../aletheia-docs';
import { declineEmail, receivedEmail, reviewEmail, signLinkEmail } from './emails';
import { consentRecords, sha256Hex } from './hash';
import { DRAFT_RETENTION_DAYS, EMAIL_LOG_RETENTION_DAYS } from './retention';

export type BetaDeps = Deps & {
  blob: BlobStore;
  sealer: Sealer;
  siteUrl: string;
  /** BETA_REVIEW_EMAIL; null skips the review email. */
  reviewEmail: string | null;
  /** The Aletheia Terms and Privacy Policy as fetched now (lib/aletheia-docs.ts). Throws when they can't be. */
  legalDocs: () => Promise<LegalDocs>;
  now?: () => Date;
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
export const SIGN_LINK_TTL_MS = 7 * DAY;
export const SIGNING_SESSION_TTL_MS = 2 * HOUR;
export const KEY_SESSION_TTL_MS = 1 * HOUR;
export const DRAFT_TTL_MS = DRAFT_RETENTION_DAYS * DAY;
/** Aletheia beta licenses run six months. */
export const BETA_LICENSE_MONTHS = 6;
/** Allowed client clock skew into the future. */
const SKEW_MS = 1 * MIN;
/** Apply-time consents must have been ticked within this window. */
const CONSENT_MAX_AGE_MS = 24 * HOUR;
const UA_MAX = 512;
const FRAME = BETA_FRAME; // paths only; text comes from betaAgreement(docs.version)

const nowOf = (deps: { now?: () => Date }) => deps.now?.() ?? new Date();
const errType = (err: unknown) => (err instanceof Error ? err.name : typeof err);

export const draftPath = (applicationId: string, sha: string) => signed.draftPath(FRAME, applicationId, sha);
export const signedPdfPath = (documentId: string) => signed.signedPdfPath(FRAME, documentId);
const tryDelete = signed.tryDelete;

/** Case-insensitive, whitespace-normalised name comparison key. */
export function nameKey(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseIso(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------- apply

/** A declined applicant may apply again this many months after the decline. */
export const REAPPLY_AFTER_MONTHS = 3;

export type ApplyOutcome = 'sent' | 'exists' | 'rate_limited' | { invalid: string };

/**
 * Checks apply-time consents beyond the schema: exactly the allowed ids, all
 * required ones present, and every tick time within the last 24h and not in
 * the future (1 minute of clock skew allowed).
 */
export function checkApplyConsents(consents: Record<string, string>, now: Date): string | null {
  const allowed = new Set(REQUIRED_AT_APPLY);
  for (const id of REQUIRED_AT_APPLY) if (!Object.hasOwn(consents, id)) return `Consent ${id} is required.`;
  for (const [id, at] of Object.entries(consents)) {
    if (!allowed.has(id)) return `Unexpected consent ${id}.`;
    const t = parseIso(at)?.getTime();
    if (t === undefined) return `Consent ${id} has an invalid time.`;
    if (t > now.getTime() + SKEW_MS) return `Consent ${id} is ticked in the future.`;
    if (t < now.getTime() - CONSENT_MAX_AGE_MS) return `Consent ${id} is too old. Please tick it again.`;
  }
  return null;
}

async function sendSignLink(deps: BetaDeps, email: string, token: string, expiresAt: Date, resume: boolean) {
  await deps.mailer.send({
    to: email,
    ...signLinkEmail({ url: `${deps.siteUrl}/aletheia/beta/sign?t=${token}`, expiresAt, resume }),
  });
  await deps.db.insert(emailSends).values({ email, kind: 'sign-link', sentAt: nowOf(deps) });
}

/** Fields that reset whenever a draft gets a new link: the old document and session no longer count. */
const resetDraft = {
  signLinkUsedAt: null,
  sessionHash: null,
  sessionExpiresAt: null,
  emailConfirmedAt: null,
  draftPdfPath: null,
  draftPdfSha256: null,
  signatureBlock: null,
  documentCreatedAt: null,
  documentViewedAt: null,
} as const;

/**
 * A new application, or new answers for an address whose latest application
 * is still a draft. An address whose application was already submitted or
 * approved gets nothing new ('exists'), and so does one declined less than
 * REAPPLY_AFTER_MONTHS ago. After that a declined address may apply again
 * as a new application. The route answers 202
 * either way, so the response doesn't reveal which addresses have applied.
 * Input must already have passed applicationInputSchema.
 */
export async function apply(deps: BetaDeps, input: ApplicationInput): Promise<ApplyOutcome> {
  const now = nowOf(deps);
  const problem = checkApplyConsents(input.consents, now);
  if (problem) return { invalid: problem };
  // C1 names a version of the Terms and Privacy Policy; it must be the one in force now.
  const docs = await deps.legalDocs();
  if (input.legalVersion !== docs.version) {
    return { invalid: 'The Terms of Service and Privacy Policy were updated. Reload the page and review them again.' };
  }

  const email = normalizeEmail(input.answers.email);
  if (await isRateLimited(deps, email)) return 'rate_limited';

  const [latest] = await deps.db
    .select()
    .from(betaApplications)
    .where(eq(betaApplications.email, email))
    .orderBy(desc(betaApplications.createdAt))
    .limit(1);
  if (latest && latest.status !== 'draft' && !(await mayReapply(deps, latest, now))) return 'exists';
  const draft = latest?.status === 'draft' ? latest : undefined;

  const token = newLinkToken();
  const expiresAt = new Date(now.getTime() + SIGN_LINK_TTL_MS);
  const values = {
    answers: { ...input.answers, email },
    consents: consentRecords(input.consents, docs.version),
    acceptedDocs: [
      { d: 'terms' as const, v: docs.terms.version, h: docs.terms.sha256 },
      { d: 'privacy' as const, v: docs.privacy.version, h: docs.privacy.sha256 },
    ],
    signLinkHash: hashLinkToken(token),
    signLinkExpiresAt: expiresAt,
    ...resetDraft,
  };
  if (draft) {
    // Guarded: a sign that lands between the read and this write must not be overwritten.
    const [updated] = await deps.db
      .update(betaApplications)
      .set(values)
      .where(and(eq(betaApplications.id, draft.id), eq(betaApplications.status, 'draft'), isNull(betaApplications.documentId)))
      .returning({ id: betaApplications.id });
    if (!updated) return 'exists';
    await tryDelete(deps.blob, [draft.draftPdfPath]);
  } else {
    await deps.db.insert(betaApplications).values({ id: randomUUID(), email, status: 'draft', createdAt: now, ...values });
  }
  await sendSignLink(deps, email, token, expiresAt, false);
  return 'sent';
}

/** A declined application whose latest decline is at least REAPPLY_AFTER_MONTHS old. */
async function mayReapply(deps: BetaDeps, app: BetaApplication, now: Date): Promise<boolean> {
  if (app.status !== 'declined') return false;
  const [last] = await deps.db
    .select({ decidedAt: documentReviews.decidedAt })
    .from(documentReviews)
    .where(and(eq(documentReviews.applicationId, app.id), eq(documentReviews.decision, 'declined')))
    .orderBy(desc(documentReviews.decidedAt))
    .limit(1);
  return !!last && addMonths(last.decidedAt, REAPPLY_AFTER_MONTHS) <= now;
}

/**
 * "Resume signing": a fresh signing link for an address whose latest
 * application is an unsigned draft. The old link stops working, and the
 * document is rebuilt from the stored answers when the new link is opened.
 */
export async function resume(deps: BetaDeps, rawEmail: string): Promise<'sent' | 'none' | 'rate_limited'> {
  const email = normalizeEmail(rawEmail);
  if (await isRateLimited(deps, email)) return 'rate_limited';
  const [latest] = await deps.db
    .select()
    .from(betaApplications)
    .where(eq(betaApplications.email, email))
    .orderBy(desc(betaApplications.createdAt))
    .limit(1);
  if (!latest || latest.status !== 'draft' || latest.documentId) return 'none';

  const now = nowOf(deps);
  const token = newLinkToken();
  const expiresAt = new Date(now.getTime() + SIGN_LINK_TTL_MS);
  const [updated] = await deps.db
    .update(betaApplications)
    .set({ signLinkHash: hashLinkToken(token), signLinkExpiresAt: expiresAt, ...resetDraft })
    .where(and(eq(betaApplications.id, latest.id), eq(betaApplications.status, 'draft'), isNull(betaApplications.documentId)))
    .returning({ id: betaApplications.id });
  if (!updated) return 'none';
  await tryDelete(deps.blob, [latest.draftPdfPath]);
  await sendSignLink(deps, email, token, expiresAt, true);
  return 'sent';
}

// ---------------------------------------------------------------- signing link and session

export type LinkState = 'valid' | 'used' | 'expired' | 'invalid';

function linkState(app: BetaApplication | undefined, now: Date): LinkState {
  if (!app) return 'invalid';
  if (app.signLinkUsedAt || app.status !== 'draft' || app.documentId) return 'used';
  if (!app.signLinkExpiresAt || app.signLinkExpiresAt <= now) return 'expired';
  return 'valid';
}

async function appBySignLink(deps: Pick<BetaDeps, 'db'>, token: string) {
  const [app] = await deps.db
    .select()
    .from(betaApplications)
    .where(eq(betaApplications.signLinkHash, hashLinkToken(token)))
    .limit(1);
  return app;
}

/** For the GET of the sign page: reports the link's state without consuming it. */
export async function peekSigningLink(deps: Pick<BetaDeps, 'db' | 'now'>, token: string): Promise<LinkState> {
  if (!looksLikeLinkToken(token)) return 'invalid';
  return linkState(await appBySignLink(deps, token), nowOf(deps));
}

export type OpenResult =
  | { ok: true; sessionToken: string; expiresAt: Date }
  | { ok: false; reason: 'used' | 'expired' | 'invalid' };

/**
 * Opening the emailed link (a POST from the confirm page, so link scanners
 * that GET it don't burn it). Builds the unsigned PDF, stores it, then
 * consumes the link, confirms the address and starts the signing session in
 * one conditional UPDATE. A loser of a concurrent open gets 'used'.
 *
 * If the consent text changed since the applicant ticked it, the link is
 * reported 'expired' and the applicant has to apply again.
 */
export async function openSigningLink(deps: BetaDeps, token: string): Promise<OpenResult> {
  if (!looksLikeLinkToken(token)) return { ok: false, reason: 'invalid' };
  const now = nowOf(deps);
  const app = await appBySignLink(deps, token);
  const state = linkState(app, now);
  if (state !== 'valid') return { ok: false, reason: state };
  const def = betaAgreement((await deps.legalDocs()).version);
  if (signed.consentsAreStale(def, app.consents)) return { ok: false, reason: 'expired' };

  const { bytes, signatureBlock } = await buildUnsignedPdf(def, {
    applicationId: app.id,
    details: describeAnswers(app.answers as Answers),
    consents: app.consents,
    createdAt: now,
  });
  const sha = sha256Hex(bytes);
  const path = draftPath(app.id, sha);
  // Deterministic bytes: an identical concurrent build may already be stored.
  if (!(await deps.blob.get(path))) {
    try {
      await deps.blob.put(path, bytes, 'application/pdf');
    } catch (err) {
      if (!(await deps.blob.get(path))) throw err;
    }
  }

  const sessionToken = newLinkToken();
  const expiresAt = new Date(now.getTime() + SIGNING_SESSION_TTL_MS);
  const [won] = await deps.db
    .update(betaApplications)
    .set({
      signLinkUsedAt: now,
      emailConfirmedAt: now,
      sessionHash: hashLinkToken(sessionToken),
      sessionExpiresAt: expiresAt,
      draftPdfPath: path,
      draftPdfSha256: sha,
      signatureBlock,
      documentCreatedAt: now,
      documentViewedAt: null,
    })
    .where(
      and(
        eq(betaApplications.id, app.id),
        eq(betaApplications.signLinkHash, hashLinkToken(token)),
        isNull(betaApplications.signLinkUsedAt),
        gt(betaApplications.signLinkExpiresAt, now),
        eq(betaApplications.status, 'draft'),
        isNull(betaApplications.documentId),
      ),
    )
    .returning({ id: betaApplications.id });

  if (!won) {
    const [after] = await deps.db.select().from(betaApplications).where(eq(betaApplications.id, app.id)).limit(1);
    if (after?.draftPdfPath !== path) await tryDelete(deps.blob, [path]);
    return { ok: false, reason: 'used' };
  }
  if (app.draftPdfPath && app.draftPdfPath !== path) await tryDelete(deps.blob, [app.draftPdfPath]);
  return { ok: true, sessionToken, expiresAt };
}

export type Session =
  | { kind: 'signing'; application: BetaApplication }
  | { kind: 'signed'; application: BetaApplication; document: SignedDocument };

/** The signing (or post-signing) session behind a beta_session cookie value, or null. */
export async function getSession(
  deps: Pick<BetaDeps, 'db' | 'now'>,
  cookieValue: string | undefined,
): Promise<Session | null> {
  if (!looksLikeLinkToken(cookieValue)) return null;
  const [app] = await deps.db
    .select()
    .from(betaApplications)
    .where(and(eq(betaApplications.sessionHash, hashLinkToken(cookieValue)), gt(betaApplications.sessionExpiresAt, nowOf(deps))))
    .limit(1);
  if (!app) return null;
  if (app.documentId) {
    const [document] = await deps.db.select().from(signedDocuments).where(eq(signedDocuments.id, app.documentId)).limit(1);
    return document ? { kind: 'signed', application: app, document } : null;
  }
  if (app.status === 'draft' && app.emailConfirmedAt && app.draftPdfPath) return { kind: 'signing', application: app };
  return null;
}

// ---------------------------------------------------------------- document

export type DocumentResult =
  | { ok: true; bytes: Uint8Array; filename: string }
  | { ok: false; reason: 'session' | 'missing' | 'integrity' };

const dateStamp = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The PDF for the session: the unsigned draft while signing (and records the
 * first view), the signed copy after. Either is checked against its stored
 * SHA-256 before it is served.
 */
export async function getDocument(deps: BetaDeps, cookieValue: string | undefined): Promise<DocumentResult> {
  const session = await getSession(deps, cookieValue);
  if (!session) return { ok: false, reason: 'session' };

  if (session.kind === 'signed') {
    const doc = session.document;
    const bytes = await deps.blob.get(doc.pdfPath);
    if (!bytes) return { ok: false, reason: 'missing' };
    if (sha256Hex(bytes) !== doc.pdfSha256) return { ok: false, reason: 'integrity' };
    return { ok: true, bytes, filename: `aletheia-beta-application-${dateStamp(doc.signedAt)}.pdf` };
  }

  const app = session.application;
  const bytes = await deps.blob.get(app.draftPdfPath!);
  if (!bytes) return { ok: false, reason: 'missing' };
  if (sha256Hex(bytes) !== app.draftPdfSha256) return { ok: false, reason: 'integrity' };
  if (!app.documentViewedAt) {
    await deps.db
      .update(betaApplications)
      .set({ documentViewedAt: nowOf(deps) })
      .where(
        and(
          eq(betaApplications.id, app.id),
          eq(betaApplications.draftPdfSha256, app.draftPdfSha256!),
          isNull(betaApplications.documentViewedAt),
        ),
      );
  }
  return { ok: true, bytes, filename: `aletheia-beta-application-${dateStamp(app.documentCreatedAt ?? nowOf(deps))}.pdf` };
}

// ---------------------------------------------------------------- sign

export type SignOutcome =
  | { ok: true; documentId: string }
  | { ok: false; error: 'session' | 'already_signed' | 'name_mismatch' | 'invalid' | 'store_failed' };

export type RequestMeta = { ip: string | null; ua: string | null };

/**
 * Checks the session, the C12 time and the typed name, then stamps, seals and
 * stores through lib/agreements/signed. The evidence row is inserted in the
 * same statement that marks the application submitted, so a double submit
 * stores one record, and any failure leaves nothing submitted; the applicant
 * can sign again.
 */
export async function sign(
  deps: BetaDeps,
  cookieValue: string | undefined,
  input: { name: string; consentEsignAt: string },
  meta: RequestMeta,
): Promise<SignOutcome> {
  const session = await getSession(deps, cookieValue);
  if (!session) return { ok: false, error: 'session' };
  if (session.kind === 'signed') return { ok: false, error: 'already_signed' };
  const app = session.application;
  const now = nowOf(deps);
  const answers = app.answers as Answers;

  // The document must have been fetched for viewing (GET /api/beta/document) first.
  if (!app.documentViewedAt || !app.signatureBlock || !app.draftPdfSha256 || !app.emailConfirmedAt || !app.documentCreatedAt) {
    return { ok: false, error: 'invalid' };
  }
  // C12 ticked within the session (now-2h .. now+1min), and not before the document was viewed.
  const esignAt = parseIso(input.consentEsignAt);
  const earliest = Math.max(now.getTime() - SIGNING_SESSION_TTL_MS, app.documentViewedAt.getTime() - SKEW_MS);
  if (!esignAt || esignAt.getTime() > now.getTime() + SKEW_MS || esignAt.getTime() < earliest) {
    return { ok: false, error: 'invalid' };
  }
  const typed = input.name.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!typed || nameKey(typed) !== nameKey(answers.fullName)) return { ok: false, error: 'name_mismatch' };

  // The terms in force must still be the ones ticked and shown in the document.
  const def = betaAgreement((await deps.legalDocs()).version);
  if (signed.consentsAreStale(def, app.consents)) return { ok: false, error: 'invalid' };

  const draft = await deps.blob.get(app.draftPdfPath!);
  if (!draft || sha256Hex(draft) !== app.draftPdfSha256) {
    console.error('beta sign: draft missing or changed');
    return { ok: false, error: 'store_failed' };
  }

  const result = await signed.signAndStore(deps, {
    definition: def,
    applicationId: app.id,
    draft,
    unsignedSha256: app.draftPdfSha256,
    signatureBlock: app.signatureBlock,
    signer: { name: answers.fullName, email: app.email },
    typedName: typed,
    answers,
    blocks: signed.signedBlocks(def, app.consents, esignAt.toISOString()),
    emailConfirmedAt: app.emailConfirmedAt,
    signedAt: now,
    events: [
      { type: 'document_created', at: app.documentCreatedAt.toISOString() },
      { type: 'email_confirmed', at: app.emailConfirmedAt.toISOString() },
      { type: 'document_viewed', at: app.documentViewedAt.toISOString() },
      { type: 'consent_esign', at: esignAt.toISOString() },
      { type: 'signed', at: now.toISOString() },
    ],
    ip: meta.ip,
    ua: meta.ua ? meta.ua.slice(0, UA_MAX) : null,
    // Marks the application submitted, only if it is still this unsigned draft in this session.
    claim: (documentId) => sql`
      UPDATE ${betaApplications}
      SET "status" = 'submitted', "document_id" = ${documentId}::uuid
      WHERE "id" = ${app.id}::uuid
        AND "status" = 'draft'
        AND "document_id" IS NULL
        AND "session_hash" = ${app.sessionHash}
        AND "session_expires_at" > ${now.toISOString()}::timestamptz
        AND "draft_pdf_sha256" = ${app.draftPdfSha256}
      RETURNING "id"`,
  });
  // 'lost': another attempt won (double submit), or the draft changed under us.
  if (!result.ok) return { ok: false, error: result.error === 'lost' ? 'already_signed' : 'store_failed' };
  const documentId = result.documentId;

  await notifyReceived(deps, app.id);
  await tryDelete(deps.blob, [app.draftPdfPath]);
  return { ok: true, documentId };
}

/** After a successful sign: tell the applicant, and the reviewer if one is set. Failures don't undo the submission. */
async function notifyReceived(deps: BetaDeps, applicationId: string) {
  let app: BetaApplication;
  let document: SignedDocument;
  try {
    [app] = await deps.db.select().from(betaApplications).where(eq(betaApplications.id, applicationId)).limit(1);
    [document] = await deps.db.select().from(signedDocuments).where(eq(signedDocuments.id, app.documentId!)).limit(1);
  } catch (err) {
    console.error('beta notify: lookup failed', errType(err));
    return;
  }
  try {
    await deps.mailer.send({ to: app.email, ...receivedEmail() });
    await deps.db.insert(emailSends).values({ email: app.email, kind: 'received', sentAt: nowOf(deps) });
  } catch (err) {
    console.error('beta received email failed', errType(err));
  }
  if (!deps.reviewEmail) return;
  try {
    await deps.mailer.send({ to: deps.reviewEmail, ...reviewEmail({ application: app, document, siteUrl: deps.siteUrl }) });
  } catch (err) {
    console.error('beta review email failed', errType(err));
  }
}

// ---------------------------------------------------------------- key page

export type KeyResult =
  | {
      ok: true;
      token: string;
      expiresAt: Date | null;
      downloadUrl: string;
      hasDocument: boolean;
      /** A 1h session for the signed document, when there is one. */
      session: { token: string; expiresAt: Date } | null;
    }
  | { ok: false; reason: 'used' | 'expired' | 'invalid' | 'attestation_required' | 'attestation_invalid' };

/** The licensee's renewed C2 confirmation, as the key page sends it. */
export type RenewalAttestation = {
  version: string;
  shownAt: string;
  tickedAt: Record<string, string>;
  sentAt?: string;
};

/**
 * Reveals the key behind a key link once, and opens a 1h session for the signed copy if there is one.
 * A renewed license needs `attestation` (C2 again); without it the answer is
 * 'attestation_required' and the link stays unused.
 */
export async function revealKey(
  deps: BetaDeps,
  token: string,
  attestation?: RenewalAttestation,
  meta?: RequestMeta,
): Promise<KeyResult> {
  const attest = attestation
    ? async (license: { email: string }) => {
        const r = await acceptAgreement(
          { db: deps.db as unknown as AgreementsDb, now: deps.now },
          {
            definition: ALETHEIA_RENEWAL,
            ...attestation,
            // The emailed link proves the address.
            subject: license.email,
            subjectVerified: true,
            meta,
          },
        );
        return r.ok;
      }
    : undefined;
  const r = await revealKeyLink(deps, token, attest);
  if (!r.ok) return r;
  let session: { token: string; expiresAt: Date } | null = null;
  if (r.applicationId) {
    const now = nowOf(deps);
    const sessionToken = newLinkToken();
    const expiresAt = new Date(now.getTime() + KEY_SESSION_TTL_MS);
    const [app] = await deps.db
      .update(betaApplications)
      .set({ sessionHash: hashLinkToken(sessionToken), sessionExpiresAt: expiresAt })
      .where(and(eq(betaApplications.id, r.applicationId), sql`${betaApplications.documentId} IS NOT NULL`))
      .returning({ id: betaApplications.id });
    if (app) session = { token: sessionToken, expiresAt };
  }
  return {
    ok: true,
    token: r.token,
    expiresAt: r.license.expiresAt,
    downloadUrl: deps.downloadUrl,
    hasDocument: session !== null,
    session,
  };
}

// ---------------------------------------------------------------- admin

export type ReviewInput = {
  applicationId: string;
  reviewer: string;
  licenseCheck?: LicenseCheck;
  notes?: string;
};

export type ReviewOutcome =
  | { ok: true; review: DocumentReview; lid: string | null; emailed: boolean }
  | { ok: false; error: 'not_found' | 'not_submitted' };

async function claimForDecision(deps: BetaDeps, applicationId: string, to: 'approved' | 'declined') {
  const [app] = await deps.db
    .update(betaApplications)
    .set({ status: to })
    .where(
      and(
        eq(betaApplications.id, applicationId),
        eq(betaApplications.status, 'submitted'),
        sql`${betaApplications.documentId} IS NOT NULL`,
      ),
    )
    .returning();
  if (app) return { app };
  const [exists] = await deps.db
    .select({ id: betaApplications.id })
    .from(betaApplications)
    .where(eq(betaApplications.id, applicationId))
    .limit(1);
  return { error: exists ? ('not_submitted' as const) : ('not_found' as const) };
}

/**
 * Approve a submitted application: record the review, issue a 6-month license,
 * store its lid on the application and email a single-use key link. If the
 * email fails the approval stands (emailed: false); resend with "key-link".
 */
export async function approve(deps: BetaDeps, input: ReviewInput & { licenseCheck: LicenseCheck }): Promise<ReviewOutcome> {
  const claimed = await claimForDecision(deps, input.applicationId, 'approved');
  if (!claimed.app) return { ok: false, error: claimed.error };
  const app = claimed.app;
  const now = nowOf(deps);

  let lid: string | null = null;
  let review: DocumentReview;
  try {
    const license = await issueLicense(deps, app.email, addMonths(now, BETA_LICENSE_MONTHS));
    lid = license.lid;
    await deps.db.update(betaApplications).set({ lid }).where(eq(betaApplications.id, app.id));
    // The append-only review row goes last, so nothing before it needs undoing once it exists.
    [review] = await deps.db
      .insert(documentReviews)
      .values({
        id: randomUUID(),
        documentId: app.documentId!,
        applicationId: app.id,
        reviewer: input.reviewer,
        decision: 'approved',
        licenseCheck: input.licenseCheck,
        notes: input.notes ?? null,
        lid,
        decidedAt: now,
      })
      .returning();
  } catch (err) {
    // Nothing was recorded as reviewed: undo the license and the status.
    if (lid) await deps.db.delete(licenses).where(eq(licenses.lid, lid));
    await deps.db
      .update(betaApplications)
      .set({ status: 'submitted', lid: null })
      .where(eq(betaApplications.id, app.id));
    throw err;
  }

  let emailed = true;
  try {
    const [license] = await deps.db.select().from(licenses).where(eq(licenses.lid, lid!)).limit(1);
    await sendKeyLink(deps, license, 'issue', app.id);
  } catch (err) {
    console.error('beta approve: key link email failed', errType(err));
    emailed = false;
  }
  return { ok: true, review, lid, emailed };
}

/** Decline a submitted application: record the review and send a short neutral email. */
export async function decline(deps: BetaDeps, input: ReviewInput): Promise<ReviewOutcome> {
  const claimed = await claimForDecision(deps, input.applicationId, 'declined');
  if (!claimed.app) return { ok: false, error: claimed.error };
  const app = claimed.app;
  const now = nowOf(deps);
  let review: DocumentReview;
  try {
    [review] = await deps.db
      .insert(documentReviews)
      .values({
        id: randomUUID(),
        documentId: app.documentId!,
        applicationId: app.id,
        reviewer: input.reviewer,
        decision: 'declined',
        licenseCheck: input.licenseCheck ?? null,
        notes: input.notes ?? null,
        decidedAt: now,
      })
      .returning();
  } catch (err) {
    await deps.db.update(betaApplications).set({ status: 'submitted' }).where(eq(betaApplications.id, app.id));
    throw err;
  }
  let emailed = true;
  try {
    await deps.mailer.send({ to: app.email, ...declineEmail({ reapplyAfter: addMonths(now, REAPPLY_AFTER_MONTHS) }) });
    await deps.db.insert(emailSends).values({ email: app.email, kind: 'decline', sentAt: now });
  } catch (err) {
    console.error('beta decline email failed', errType(err));
    emailed = false;
  }
  return { ok: true, review, lid: null, emailed };
}

/** Application rows without the link and session hashes. */
function publicApplication(app: BetaApplication) {
  const { signLinkHash: _s, sessionHash: _h, ...rest } = app;
  return rest;
}

export async function listApplications(deps: Pick<BetaDeps, 'db'>, status?: BetaApplication['status']) {
  const rows = await deps.db
    .select({
      id: betaApplications.id,
      email: betaApplications.email,
      fullName: sql<string>`${betaApplications.answers}->>'fullName'`,
      status: betaApplications.status,
      createdAt: betaApplications.createdAt,
      documentId: betaApplications.documentId,
      lid: betaApplications.lid,
    })
    .from(betaApplications)
    .where(status ? eq(betaApplications.status, status) : undefined)
    .orderBy(desc(betaApplications.createdAt))
    .limit(500);
  return rows;
}

/** Everything about one application, for review. */
export async function getApplication(deps: Pick<BetaDeps, 'db'>, id: string) {
  const [app] = await deps.db.select().from(betaApplications).where(eq(betaApplications.id, id)).limit(1);
  if (!app) return null;
  const documents = await deps.db
    .select()
    .from(signedDocuments)
    .where(eq(signedDocuments.applicationId, id))
    .orderBy(desc(signedDocuments.signedAt));
  const reviews = await deps.db
    .select()
    .from(documentReviews)
    .where(eq(documentReviews.applicationId, id))
    .orderBy(desc(documentReviews.decidedAt));
  return {
    application: publicApplication(app),
    answers: describeAnswers(app.answers as Answers),
    consents: app.consents,
    document: documents.find((d) => d.id === app.documentId) ?? documents[0] ?? null,
    documents,
    reviews,
  };
}

// ---------------------------------------------------------------- admin: signed documents

export type SignedFileKind = 'pdf' | 'audit';
export type FileCheck = 'ok' | 'missing' | 'integrity' | 'unavailable';
export type SignedFile =
  | { ok: true; bytes: Uint8Array; filename: string; contentType: string }
  | { ok: false; reason: 'not_found' | 'missing' | 'integrity' };

async function loadChecked(blob: BlobStore, path: string, sha256: string) {
  const bytes = await blob.get(path);
  if (!bytes) return { check: 'missing' as const, bytes: null };
  if (sha256Hex(bytes) !== sha256) return { check: 'integrity' as const, bytes: null };
  return { check: 'ok' as const, bytes };
}

/**
 * The audit trail as JSON, built from the evidence row: the same shape as the
 * audit.json files stored for rows signed before events moved to Postgres.
 */
function auditJsonOf(doc: SignedDocument): Uint8Array {
  const trail: Omit<AuditTrail, 'applicationId'> & { applicationId: string | null; pdfSha256: string; seal: Seal } = {
    docType: doc.docType,
    docVersion: doc.docVersion,
    documentId: doc.id,
    applicationId: doc.applicationId,
    signerName: doc.signerName,
    signerEmail: doc.signerEmail,
    unsignedSha256: doc.unsignedSha256,
    events: doc.events ?? [],
    signerIp: doc.signerIp,
    signerUa: doc.signerUa,
    pdfSha256: doc.pdfSha256,
    seal: { alg: doc.sealAlg, keyId: doc.sealKeyId, fingerprint: doc.sealFingerprint, signature: doc.seal },
  };
  return new TextEncoder().encode(JSON.stringify(trail, null, 2));
}

/**
 * Admin: the signed PDF or the audit trail of one signed document. Stored files
 * are served only when they still match the SHA-256 recorded when it was
 * signed. Rows signed before events moved to Postgres serve their stored
 * audit JSON; newer rows build it from the row.
 */
export async function readSignedFile(
  deps: Pick<BetaDeps, 'db' | 'blob'>,
  documentId: string,
  kind: SignedFileKind,
): Promise<SignedFile> {
  const [doc] = await deps.db.select().from(signedDocuments).where(eq(signedDocuments.id, documentId)).limit(1);
  if (!doc) return { ok: false, reason: 'not_found' };
  const base = `aletheia-beta-application-${dateStamp(doc.signedAt)}-${doc.id.slice(0, 8)}`;
  const auditFile = (bytes: Uint8Array): SignedFile => ({ ok: true, bytes, filename: `${base}-audit.json`, contentType: 'application/json' });
  if (kind === 'audit' && (!doc.auditPath || !doc.auditSha256)) return auditFile(auditJsonOf(doc));
  const r =
    kind === 'pdf'
      ? await loadChecked(deps.blob, doc.pdfPath, doc.pdfSha256)
      : await loadChecked(deps.blob, doc.auditPath!, doc.auditSha256!);
  if (!r.bytes) return { ok: false, reason: r.check as 'missing' | 'integrity' };
  return kind === 'pdf' ? { ok: true, bytes: r.bytes, filename: `${base}.pdf`, contentType: 'application/pdf' } : auditFile(r.bytes);
}

/** 'database': the events are on the row; there is no audit file to check. */
export type AuditCheck = FileCheck | 'database';

export type DocumentReviewInfo = {
  pdf: FileCheck;
  audit: AuditCheck;
  /** From the row, else the audit JSON; empty when neither can be read. */
  events: AuditEvent[];
  signerUa: string | null;
};

const validEvents = (events: unknown): AuditEvent[] =>
  Array.isArray(events) ? events.filter((e) => typeof e?.type === 'string' && !Number.isNaN(Date.parse(e?.at))) : [];

/**
 * Admin: checks the stored files of a signed document against their recorded
 * hashes and reads the signing events: from the row, or from the audit JSON on
 * rows signed before events moved to Postgres. A storage error marks a file
 * 'unavailable' instead of throwing, so the review page still renders.
 */
export async function checkSignedDocument(deps: Pick<BetaDeps, 'blob'>, doc: SignedDocument): Promise<DocumentReviewInfo> {
  const safe = (path: string, sha256: string) =>
    loadChecked(deps.blob, path, sha256).catch(() => ({ check: 'unavailable' as const, bytes: null }));
  const hasFile = !!doc.auditPath && !!doc.auditSha256;
  const [pdf, audit] = await Promise.all([
    safe(doc.pdfPath, doc.pdfSha256),
    hasFile ? safe(doc.auditPath!, doc.auditSha256!) : { check: 'database' as const, bytes: null },
  ]);
  let events = validEvents(doc.events);
  if (!doc.events && audit.bytes) {
    try {
      events = validEvents((JSON.parse(new TextDecoder().decode(audit.bytes)) as Partial<AuditTrail>).events);
    } catch {
      // A hash-matched file that isn't JSON leaves the events empty.
    }
  }
  return { pdf: pdf.check, audit: audit.check, events, signerUa: doc.signerUa };
}

/** Admin: email a fresh key link for an active license. */
export async function resendKeyLink(deps: BetaDeps, lid: string): Promise<'sent' | 'not_found' | 'inactive'> {
  const [license] = await deps.db.select().from(licenses).where(eq(licenses.lid, lid)).limit(1);
  if (!license) return 'not_found';
  const now = nowOf(deps);
  if (license.revokedAt || license.replacedBy || (license.expiresAt && license.expiresAt <= now) || license.kid !== deps.key.kid) {
    return 'inactive';
  }
  await sendKeyLink(deps, license, 'key-link');
  return 'sent';
}

// ---------------------------------------------------------------- cleanup

export { EMAIL_LOG_RETENTION_DAYS };

/**
 * Daily: delete unsigned drafts created more than 7 days ago that have no
 * live link or session, and their draft PDFs. Signed records are never touched.
 */
export async function cleanupDrafts(deps: BetaDeps, limit = 500): Promise<{ deleted: number }> {
  const now = nowOf(deps);
  const stale = await deps.db
    .select({ id: betaApplications.id, draftPdfPath: betaApplications.draftPdfPath })
    .from(betaApplications)
    .where(
      and(
        eq(betaApplications.status, 'draft'),
        isNull(betaApplications.documentId),
        lt(betaApplications.createdAt, new Date(now.getTime() - DRAFT_TTL_MS)),
        or(isNull(betaApplications.signLinkExpiresAt), lt(betaApplications.signLinkExpiresAt, now)),
        or(isNull(betaApplications.sessionExpiresAt), lt(betaApplications.sessionExpiresAt, now)),
      ),
    )
    .limit(limit);
  if (!stale.length) return { deleted: 0 };
  await tryDelete(deps.blob, stale.map((s) => s.draftPdfPath));
  const ids = stale.map((s) => s.id);
  const deleted = await deps.db
    .delete(betaApplications)
    .where(and(inArray(betaApplications.id, ids), eq(betaApplications.status, 'draft'), isNull(betaApplications.documentId)))
    .returning({ id: betaApplications.id });
  return { deleted: deleted.length };
}

/**
 * Daily: delete email log rows older than EMAIL_LOG_RETENTION_DAYS, whatever their
 * status. The logs hold addresses, subjects and send times, and exist for rate limits
 * and for finding failed sends. Bodies are kept only for failed mail that is not
 * marked secret, and go with the row.
 */
export async function cleanupEmailLogs(deps: BetaDeps): Promise<{ sends: number; outbox: number }> {
  const cutoff = new Date(nowOf(deps).getTime() - EMAIL_LOG_RETENTION_DAYS * DAY);
  const sends = await deps.db.delete(emailSends).where(lt(emailSends.sentAt, cutoff)).returning({ id: emailSends.id });
  const outbox = await deps.db
    .delete(emailOutbox)
    .where(lt(emailOutbox.createdAt, cutoff))
    .returning({ id: emailOutbox.id });
  return { sends: sends.length, outbox: outbox.length };
}
