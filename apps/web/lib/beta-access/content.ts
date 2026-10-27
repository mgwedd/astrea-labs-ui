// Aletheia beta access form: disclosure and attestation text.
//
// Every `text` string is SHA-256 hashed as evidence of what the applicant saw.
// ANY CHANGE TO ANY TEXT HERE MUST BUMP `DOC_VERSION`. (C1 also names the Aletheia
// Terms version fetched at the time; it is hashed as shown, so a new Terms version
// makes earlier ticks stale without a DOC_VERSION change.)
//
// Client-safe: no node imports.

import { allBlocks, defineAgreement, requiredCheckboxIds, type Block } from "../agreements/define";

export type { Block };

export const DOC_TYPE = "beta-access";
export const DOC_VERSION = "2026-10-27.2"; // one version for every block in this document
export const NO_CLIENT_INFO = "Don't include any client or patient information.";


export const HANDLING_INTRO: Block = {
  id: "H0",
  text: "Aletheia is built so that patient information stays on your Mac and under your control. It is designed to support HIPAA safeguards, but it is not HIPAA certified, and using it doesn't by itself satisfy HIPAA. It doesn't replace your practice's policies, risk analysis or consent process. Here's what the app does, and what stays your job.",
};

export const HANDLING: Block[] = [
  {
    id: "H1",
    title: "Everything stays on your Mac",
    text: "Recording, transcription and AI notes all run on your Mac. There is no Aletheia account or cloud, and we can't see, recover or delete your data. The app itself has no network access. A separate built-in helper can only download fixed files: updates, a daily list of revoked keys, and AI models you choose.",
  },
  {
    id: "H2",
    title: "Who can open it",
    text: "Your macOS login protects the Mac. The app adds its own lock (Touch ID or your Mac password), which re-locks when the Mac sleeps, the screen locks or users switch, and after optional idle time. Aletheia is single-user: each clinician uses their own macOS account.",
  },
  {
    id: "H3",
    title: "Encryption at rest",
    text: "Aletheia relies on macOS FileVault to encrypt your disk, and won't create new patient records on a disk it knows is unencrypted. This version has no separate app-level encryption. That includes the local search index, which holds transcript and note text.",
  },
  {
    id: "H4",
    title: "Where your files live",
    text: "You choose the data folder during setup. Pick a folder on this Mac. A cloud-synced folder (iCloud Drive, Dropbox and similar) is copied to that provider, which then holds patient information. By default your normal Mac backups don't include the folder; backing it up, encrypted, is your job.",
  },
  {
    id: "H5",
    title: "Activity log",
    text: "The app keeps a local log of actions such as unlocks, exports and deletions, with the time and the macOS user. The log shows if entries were altered or removed. It holds no names or clinical content. You can export it for your own records or an audit.",
  },
  {
    id: "H6",
    title: "Copying and AI writing tools",
    text: "Text copied from a patient record stays on this Mac and asks clipboard managers not to keep it. Apple Intelligence and macOS Writing Tools are turned off for patient text, so it isn't sent to those services.",
  },
  {
    id: "H7",
    title: "AI drafts",
    text: "The AI writes drafts from your transcript, on your Mac. Drafts can be wrong or incomplete. You review and correct them before anything goes into a record.",
  },
  {
    id: "H8",
    title: "What stays your job",
    text: "Patient consent to record, your HIPAA risk analysis and policies, FileVault and a strong Mac password, encrypted backups, and anything you export. Exports, calendar entries and copies you make leave the app's protection.",
  },
];

export const B0: Block = {
  id: "B0",
  text: "I've read how Aletheia handles patient information and the disclosures B1 to B8 above.",
};

export const DISCLOSURES: Block[] = [
  {
    id: "B1",
    title: "Beta software.",
    text: "Aletheia is pre-release software provided by Astrea Labs LLC. It may contain bugs, may lose or corrupt data, and may change without notice. Keep your own records of anything you can't afford to lose.",
  },
  {
    id: "B2",
    title: "Runs only on your Mac.",
    text: "Recordings, transcripts, notes and AI output stay on your Mac. Astrea Labs never receives them. The app itself has no network access. A separate built-in helper connects only to fixed addresses: to check for updates, to fetch a daily signed list of revoked license keys (only while update checks are on), and to download AI models you choose. None of these carries patient information or your license key. Like any download, the servers involved (GitHub, Hugging Face, Astrea Labs) can see your IP address and app version.",
  },
  {
    id: "B3",
    title: "We are not your business associate.",
    text: "Because we never create, receive, maintain or transmit your patients' information, Astrea Labs is not a HIPAA business associate and will not sign a BAA. If HIPAA applies to you or your practice, you remain responsible for meeting it.",
  },
  {
    id: "B4",
    title: "Encryption and backups.",
    text: "Aletheia relies on macOS FileVault to encrypt data on your disk. It won't create new patient records on a disk it knows is unencrypted, and warns when it can't tell. Aletheia does not back up your data, and by default it excludes its data folder from Time Machine and iCloud, so **your normal Mac backups won't include it.** Making your own encrypted backups is your responsibility. Keep your data folder out of iCloud Drive, Dropbox, Google Drive, OneDrive and any other synced folder.",
  },
  {
    id: "B5",
    title: "Exports and calendar entries leave Aletheia's protection.",
    text: "PDF, Word and Markdown exports are unencrypted files. Sessions you add to your calendar sync wherever your calendar syncs. Where they go is your responsibility.",
  },
  {
    id: "B6",
    title: "AI drafts can be wrong.",
    text: "Transcripts and AI summaries can be inaccurate, incomplete or misleading. They are drafts. Aletheia is not a medical device and gives no clinical advice.",
  },
  {
    id: "B7",
    title: "Your license key.",
    text: "Your key is personal and works only for you. It lasts six months from the date it's issued, and we email you about 30 days before it ends so you can renew. After it expires, recording and AI keep working for a 14-day grace period, then pause. We may revoke a key if these terms are broken; the app picks up revocations when it checks for updates (if you turn update checks off, it won't), and a revoked key pauses new recordings and AI at once. **Your records stay yours.** Without a valid key, and with no time limit, you can still open, read, search, export and delete everything you've recorded. Settings → Backups → Export All Records saves all of it to a folder you choose; it warns you if that folder syncs to a cloud service or sits on an unencrypted disk.",
  },
  {
    id: "B8",
    title: "Support without patient information.",
    text: "Never send us recordings, transcripts, notes, database files, screenshots that show client details, or unredacted logs. Use the app's redacted Doctor report. If we receive patient information by mistake, we will delete it as far as we're able and tell you.",
  },
];

// The Terms and Privacy Policy are owned by the Aletheia repo and fetched by the
// site (lib/aletheia-docs.ts), so C1 names the version fetched now. The text is
// hashed as shown, version included.
export const TERMS_PATH = "astrealabs.com/aletheia/terms";
export const PRIVACY_PATH = "astrealabs.com/aletheia/privacy";

export const termsAttestation = (legalVersion: string): Block => ({
  id: "C1",
  text: `I have read and accept the Aletheia **Terms of Service** (version ${legalVersion}, ${TERMS_PATH}) and **Privacy Policy** (version ${legalVersion}, ${PRIVACY_PATH}), including the warranty disclaimer, limitation of liability and indemnification.`,
});

const OTHER_ATTESTATIONS: Block[] = [
  {
    id: "C2",
    text: "The information I've given is true. I hold the license(s) I listed and they are active and unrestricted. If I'm pre-licensed, I practise under the supervisor I named. **I will tell Astrea Labs within 10 days** if my license lapses, is restricted, or is suspended.",
  },
  {
    id: "C3",
    text: "**HIPAA is my responsibility.** Where HIPAA applies to me or my practice, I'll include Aletheia in my risk analysis and follow my practice's privacy and security policies. I understand Astrea Labs is not my business associate.",
  },
  {
    id: "C4",
    text: "**Recording consent.** Before every recording I'll obtain each participant's informed consent to be recorded and to have the recording processed by AI on my Mac, as required by the law of every place where any participant is located, including all-party-consent states such as California, Washington, Florida, Illinois and Pennsylvania. I'll record that consent in Aletheia (who consented, how and when) whenever it asks, keep any written consent in my own records, and I won't record anyone who declines. Aletheia asks for consent once per patient by default, so when the participants change I'll switch it to ask every session, or record consent again.",
  },
  {
    id: "C5",
    text: "**Clinical review.** I'll review and correct every transcript and AI draft before I rely on it or put it in a clinical record. I'm professionally responsible for my records.",
  },
  {
    id: "C6",
    text: "**Authorization.** I'm authorized to install and use Aletheia for client work: either I run my own practice, or my practice or employer (and its privacy or security officer, if it has one) has approved it.",
  },
  {
    id: "C7",
    text: "**Device security.** I'll use Aletheia only on a Mac I control, with FileVault on, a strong login password, automatic screen lock and current macOS and Aletheia updates. I won't keep the data folder in a cloud-synced location.",
  },
  {
    id: "C8",
    text: "**Special categories.** If my work involves substance use disorder records, minors, or other specially protected information, I'm responsible for the additional rules that apply (for example 42 CFR Part 2 and state minor-consent law).",
  },
  {
    id: "C9",
    text: "**No patient information to Astrea Labs.** I won't send Astrea Labs any patient information through any channel, including support email, GitHub issues, feedback forms or screen-shares.",
  },
  {
    id: "C10",
    text: "**My key is mine.** I won't share, transfer or publish my license key, and I won't use Aletheia outside the license terms. Astrea Labs may revoke my key if I break these terms.",
  },
  {
    id: "C12",
    text: "**Electronic signature.** I agree to sign this application electronically, and that my electronic signature is as binding as a handwritten one.",
  },
];

export const attestations = (legalVersion: string): Block[] => [termsAttestation(legalVersion), ...OTHER_ATTESTATIONS];

// The beta agreement as a signed-level definition (lib/agreements). C12 is the
// signing consent, ticked at the signature step. `legalVersion` is the version
// of the Aletheia Terms and Privacy Policy that C1 names.
export const betaAgreement = (legalVersion: string) => defineAgreement({
  id: "aletheia-beta",
  version: DOC_VERSION,
  level: "signed",
  title: "Aletheia Beta Access Agreement",
  terms: [HANDLING_INTRO, ...HANDLING, ...DISCLOSURES],
  checkboxes: [B0, ...attestations(legalVersion).filter((b) => b.id !== "C12")],
  signingConsent: OTHER_ATTESTATIONS.find((b) => b.id === "C12")!,
  document: {
    type: DOC_TYPE,
    title: "Aletheia beta access application",
    intro:
      "This document records the applicant's answers and every disclosure and attestation exactly as shown to " +
      "the applicant. Each block carries its text version and the SHA-256 of its stored UTF-8 text, in which bold " +
      "is marked with **. At signing, the name, date and C12 tick are stamped in section D and a signing " +
      "certificate page is appended.",
    detailsHeading: "A. About you",
    sections: {
      H: { heading: "How Aletheia handles patient information", titleLine: true },
      B: { heading: "B. What you should know (disclosures)" },
      C: { heading: "C. Attestations and consents" },
    },
    signatureHeading: "D. Signature",
    signatureLabel: "Signature (typed full name; must match A1)",
    signerNameLabel: "Name (A1)",
    signerEmailLabel: "Email (A2)",
    termsAckId: "B0",
  },
});

// Renewal: the licensee confirms C2 again before a renewed key is shown (spec G).
// A simple accept recorded against the license email.
export const ALETHEIA_RENEWAL = defineAgreement({
  id: "aletheia-beta-renewal",
  version: DOC_VERSION,
  level: "accept",
  title: "Confirm your professional license",
  terms: [],
  checkboxes: [OTHER_ATTESTATIONS.find((b) => b.id === "C2")!],
});

// Everything in the signed document, in order.
export const documentBlocks = (legalVersion: string): Block[] => allBlocks(betaAgreement(legalVersion));

// Block ids and the PDF frame don't depend on the terms version. This definition
// names a placeholder version in C1, so use it for ids and paths, never for text.
export const BETA_FRAME = betaAgreement("0000-00-00");
export const REQUIRED_AT_APPLY: string[] = requiredCheckboxIds(BETA_FRAME);
export const SIGNING_CONSENT = BETA_FRAME.signingConsent;
export const SIGNING_CONSENT_ID = SIGNING_CONSENT.id;

export function blockById(id: string, legalVersion: string): Block {
  const block = documentBlocks(legalVersion).find((b) => b.id === id);
  if (!block) throw new Error(`Unknown block id: ${id}`);
  return block;
}
