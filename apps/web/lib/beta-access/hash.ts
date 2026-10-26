// SHA-256 helpers for the beta access evidence record. Server-only.
// Thin wrappers over the shared agreement evidence (lib/agreements/evidence).
// `legalVersion` is the Aletheia Terms/Privacy version that C1 names.
import type { ConsentRecord } from '../licensing/db/schema';
import { blockRecords, sha256Hex, tickRecords } from '../agreements/evidence';
import { betaAgreement } from './content';

export { sha256Hex };

/** One record per ticked block, in document order. Throws on an unknown id. */
export function consentRecords(tickedAt: Record<string, string>, legalVersion: string): ConsentRecord[] {
  return tickRecords(betaAgreement(legalVersion), tickedAt);
}

/** Every block in the signed document, in order, with its text version and hash. */
export function documentBlockRecords(legalVersion: string): { id: string; version: string; sha256: string }[] {
  return blockRecords(betaAgreement(legalVersion));
}
