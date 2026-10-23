// SHA-256 evidence helpers shared by both levels. Server-only.
import { createHash } from 'node:crypto';
import type { ConsentRecord } from '@/lib/licensing/db/schema';
import { allBlocks, type AgreementDefinition } from './define';

export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Every block in the agreement, in document order, with its version and hash. */
export function blockRecords(def: AgreementDefinition): { id: string; version: string; sha256: string }[] {
  return allBlocks(def).map((b) => ({ id: b.id, version: def.version, sha256: sha256Hex(b.text) }));
}

/** One hash over the whole agreement: id, version, and every block's id, title and text in order. */
export function agreementSha256(def: AgreementDefinition): string {
  return sha256Hex(
    JSON.stringify({
      id: def.id,
      version: def.version,
      blocks: allBlocks(def).map((b) => [b.id, b.title ?? '', b.text]),
    }),
  );
}

/**
 * One record per ticked block, in document order. Throws on an unknown id so a
 * bad id never reaches the evidence record.
 */
export function tickRecords(def: AgreementDefinition, tickedAt: Record<string, string>): ConsentRecord[] {
  const blocks = allBlocks(def);
  for (const id of Object.keys(tickedAt)) {
    if (!blocks.some((b) => b.id === id)) throw new Error(`Unknown block id: ${id}`);
  }
  return blocks
    .filter((b) => Object.hasOwn(tickedAt, b.id))
    .map((b) => ({ id: b.id, version: def.version, sha256: sha256Hex(b.text), tickedAt: tickedAt[b.id]! }));
}
