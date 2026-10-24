// What a licensee accepted on the site, in the form the license token carries.
import { eq } from 'drizzle-orm';
import { betaApplications, signedDocuments, type ConsentRecord } from './db/schema';
import { LEGAL_VERSION } from '../beta-access/content';
import type { Deps } from './service';
import { ACCEPTED_DOCS, type Acceptance } from './token';
import shippedDocs from './shipped-docs.json';

/** Version and SHA-256 of a document exactly as the app ships it. */
export type ShippedDocEntry = { version: string; sha256: string };
export type ShippedDocs = Partial<Record<Acceptance['d'], ShippedDocEntry>>;

/** The beta agreement checkbox that accepts the terms and the privacy policy. */
export const TERMS_ACCEPT_BLOCK_ID = 'C1';

/**
 * The shipped documents' versions and hashes. Written by
 * scripts/licensing/hash-shipped-docs.ts from the app repo's TERMS.md and
 * PRIVACY.md; never typed by hand. Empty until generated, in which case no
 * acceptance is recorded.
 */
export const SHIPPED_DOCS: ShippedDocs = shippedDocs as ShippedDocs;

/**
 * Acceptance records for the token. The terms checkbox names one version; a
 * document is recorded only when the manifest has that same version, so the
 * hash is always of the text the person was told they accepted.
 */
export function acceptanceFrom(
  blocks: ConsentRecord[],
  acceptedVersion: string,
  docs: ShippedDocs = SHIPPED_DOCS,
): Acceptance[] {
  const tick = blocks.find((b) => b.id === TERMS_ACCEPT_BLOCK_ID);
  const at = tick?.tickedAt ? Math.floor(Date.parse(tick.tickedAt) / 1000) : NaN;
  if (!Number.isSafeInteger(at)) return [];
  const out: Acceptance[] = [];
  for (const d of ACCEPTED_DOCS) {
    const doc = docs[d];
    if (doc && doc.version === acceptedVersion) out.push({ d, v: doc.version, h: doc.sha256, at });
  }
  return out;
}

/**
 * What the licensee accepted, read from the signed agreement of the beta
 * application that holds this license. Empty when there is none (an admin
 * issue) or the shipped documents manifest has no matching version.
 */
export async function acceptanceFor(deps: Pick<Deps, 'db' | 'shippedDocs'>, lid: string): Promise<Acceptance[]> {
  const [row] = await deps.db
    .select({ blocks: signedDocuments.blocks })
    .from(betaApplications)
    .innerJoin(signedDocuments, eq(signedDocuments.id, betaApplications.documentId))
    .where(eq(betaApplications.lid, lid))
    .limit(1);
  return row ? acceptanceFrom(row.blocks, LEGAL_VERSION, deps.shippedDocs) : [];
}
