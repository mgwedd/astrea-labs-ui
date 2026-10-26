# Agreements (accept and signed)

One codebase serves every Astrea Labs agreement at two levels. This replaces the earlier DocuSeal plan; there is no external signing service.

## Two levels

| | Simple accept (`level: 'accept'`) | Signed (`level: 'signed'`) |
|---|---|---|
| What the person does | Reads the terms, ticks one or more unticked boxes, presses Accept | Same, plus consents to electronic records and signing, and types their name as the signature |
| Output | One evidence row | Evidence row plus a sealed PDF, emailed to the signer |
| PDF | No | Yes (`pdf-lib`), stored in private Vercel Blob |
| Seal | None | Vercel KMS Ed25519 key (`SEAL_KMS_ISSUER_ID`) signs `ASEAL1\n${documentId}\n${pdfSha256}` |
| Example | TODO: first accept-level agreement | Aletheia beta (`ALETHEIA_BETA` in `lib/beta-access/content.ts`, page `/aletheia/beta`) |

### When to use which

- Use **accept** for low-stakes terms where a durable record of "this person agreed to this exact text at this time" is enough (for example product terms, a data-use notice, a pilot acknowledgement). TODO: confirm the list with counsel.
- Use **signed** when the person needs their own copy, or we may need to prove the signature later (for example the Aletheia beta agreement). [COUNSEL TO CONFIRM] which agreements need which level.

## Definitions

`lib/agreements/define.ts`: `defineAgreement({ id, version, level, title, terms, checkboxes, signingConsent? })`.

- `terms`: read-only blocks shown first.
- `checkboxes`: each its own unticked box; required unless `optional`. At least one required box.
- `signingConsent`: signed only (required there, forbidden on accept). It is the last box, ticked at the signature step.
- `document`: signed only (required there, forbidden on accept). The PDF's frame: doc type (stored on evidence rows, blob path prefix), title, headings, labels, and `termsAckId`, the box whose tick acknowledges the terms.
- Block ids must be unique within a definition.
- Every block's text is SHA-256 hashed as evidence of what the person saw. **Any change to any text must bump `version`.**

### Add an accept-level agreement

1. Create the definition with `defineAgreement({ level: 'accept', ... })`.
2. Register it in `lib/agreements/registry.ts` (the `ALL` list).
3. It is then served at `/agreements/[id]` (accept-level only) and accepted via `POST /api/agreements/accept`.
4. Add a test under `tests/unit/agreements/`.

Apps with accounts should skip the public route and call `acceptAgreement` from `lib/agreements/service.ts` server-side with `subjectVerified: true`.

### Add a signed agreement

1. Create the definition with `defineAgreement({ level: 'signed', signingConsent, document, ... })` and register it in `lib/agreements/registry.ts`.
2. The generic machinery in `lib/agreements/signed/` takes the definition: `pdf.ts` (`buildUnsignedPdf`, `stampAndCertify`), `service.ts` (`signedBlocks`, `consentsAreStale`, `signAndStore`, blob paths), `seal.ts`, `blob.ts`.
3. The flow around it stays with the agreement: who the signer is, links, sessions, emails, and the `claim` passed to `signAndStore` (an `UPDATE ... RETURNING "id"` on its own working state, run in the same statement as the evidence insert). Aletheia beta's flow is `lib/beta-access/service.ts`.
4. Add a test like `tests/unit/agreements/signed/service.test.ts`.

## Simple accept: how it works

- Component: `components/agreements/accept-terms.tsx`.
- Service: `lib/agreements/service.ts` (`acceptAgreement`, `currentAcceptance`).
- Route: `POST /api/agreements/accept`. Protected by Vercel BotID, same-origin JSON only, validated with zod. Rate limit: 10 per hour per subject per agreement.
- The public route records `subject_verified = false`, because the email is typed and not proven. A server-side call with `subjectVerified: true` is for apps that have authenticated the person.

## Evidence stored

Table `agreement_acceptances` (migration `drizzle/0004_agreements_feedback.sql`), append-only: database triggers reject updates and deletes.

Per acceptance:

- agreement id and version, and a hash per text block (and the whole-agreement hash, see `lib/agreements/evidence.ts`);
- the subject (email) and whether it was verified (`subject_verified`);
- when the agreement was shown, when each box was ticked, and when it was accepted (server UTC);
- IP address and user agent (`ip`, `user_agent`).

Signed agreements additionally store the sealed PDF and audit data in private Vercel Blob, and the PDF is emailed to the signer. Beta signing also records IP and user agent. TODO: list the exact signed-agreement columns and blob contents from `lib/agreements/signed/service.ts`.

The same migration also creates `feedback_submissions`, which previously had no migration.

## Operations

- **Production migration has not been run.** Run it before deploying (see `docs/licensing.md`, Database).
- Env vars used here (names only): `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `SEAL_KMS_ISSUER_ID`, `RESEND_API_KEY`, `BETA_REVIEW_EMAIL`. Without `SEAL_KMS_ISSUER_ID`, dev and preview seal with an ephemeral key that cannot be verified later.
- Retention of evidence rows and PDFs: TODO: retention period [COUNSEL TO CONFIRM].

## Legal notes

- [COUNSEL TO CONFIRM] ESIGN / UETA: that ticking boxes and typing a name satisfies electronic signature requirements for each agreement we use, and that the stored evidence (timestamps, hashes, IP, user agent, sealed PDF) is sufficient to attribute and prove the act.
- [COUNSEL TO CONFIRM] Whether a simple accept needs its own consent to electronic records. Signed agreements include `signingConsent`; accept-level currently has none (`defineAgreement` forbids it).
- [COUNSEL TO CONFIRM] Whether an unverified email (`subject_verified = false`) is adequate attribution for any given agreement.
- [COUNSEL TO CONFIRM] Retention period and deletion requests, given that evidence is append-only. Database triggers block updates and deletes on `signed_documents` and `agreement_acceptances`, so signed and accepted records cannot be deleted today; application rows can. The decline email tells applicants to email support@astrealabs.com to ask for their application record to be deleted, and a declined applicant who reapplies after 3 months gets a new record while the old one is kept. We need to know what we must delete, what we may keep (and for how long) to prove an agreement, and how to answer a request.
- [COUNSEL TO CONFIRM] Right to a paper copy. Signers of signed agreements get the sealed PDF by email. Accept-level agreements produce no copy. Do we have to offer a paper copy, or a way to withdraw consent to electronic records, and how?
- [COUNSEL TO CONFIRM] Renewal re-attestation (`aletheia-beta-renewal`) is accept-level: the licensee re-ticks C2 on the key page and gets no copy. Is that enough for a continuing professional-license attestation?
- All Aletheia beta legal text is a draft (`DOC_VERSION` in `lib/beta-access/content.ts` ends in `-draft`). Counsel must review it before the beta opens; bump `DOC_VERSION` on any change.
