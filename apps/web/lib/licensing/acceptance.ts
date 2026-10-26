// What a licensee accepted on the site, in the form the license token carries.
import { eq } from 'drizzle-orm';
import { betaApplications, signedDocuments, type AcceptedDoc, type ConsentRecord } from './db/schema';
import type { Deps } from './service';
import { ACCEPTED_DOCS, type Acceptance } from './token';

/** The beta agreement checkbox that accepts the terms and the privacy policy. */
export const TERMS_ACCEPT_BLOCK_ID = 'C1';

/** The documents as recorded when the applicant ticked C1, with the tick time added. */
export function acceptanceFrom(blocks: ConsentRecord[], accepted: AcceptedDoc[] | null): Acceptance[] {
  const tick = blocks.find((b) => b.id === TERMS_ACCEPT_BLOCK_ID);
  const at = tick?.tickedAt ? Math.floor(Date.parse(tick.tickedAt) / 1000) : NaN;
  if (!accepted || !Number.isSafeInteger(at)) return [];
  const out: Acceptance[] = [];
  for (const d of ACCEPTED_DOCS) {
    const doc = accepted.find((a) => a.d === d);
    if (doc) out.push({ d, v: doc.v, h: doc.h, at });
  }
  return out;
}

/**
 * What the licensee accepted, read from the beta application that holds this
 * license. Empty when there is none (an admin issue) or the application
 * predates recording the accepted documents.
 */
export async function acceptanceFor(deps: Pick<Deps, 'db'>, lid: string): Promise<Acceptance[]> {
  const [row] = await deps.db
    .select({ blocks: signedDocuments.blocks, accepted: betaApplications.acceptedDocs })
    .from(betaApplications)
    .innerJoin(signedDocuments, eq(signedDocuments.id, betaApplications.documentId))
    .where(eq(betaApplications.lid, lid))
    .limit(1);
  return row ? acceptanceFrom(row.blocks, row.accepted) : [];
}
