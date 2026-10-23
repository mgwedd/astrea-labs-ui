// Tamper-evidence seal for signed documents: a signature over the final PDF's
// SHA-256, made with a key separate from the license-signing key. Server-only.
//
// Production: Vercel KMS (`@vercel/kms`, OIDC auth), issuer in SEAL_KMS_ISSUER_ID.
// Dev and tests: an ephemeral Ed25519 key per process. Seals made with it can't
// be verified after the process exits, so it must never seal production records.
import { createHash, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { signMessage } from '@vercel/kms';

export type Seal = { alg: string; keyId: string; fingerprint: string | null; signature: string /* base64 */ };
export type Sealer = { seal(message: string): Promise<Seal> };

export const SEAL_PREFIX = 'ASEAL1';

/** The exact UTF-8 message that gets signed. */
export function sealMessage(documentId: string, pdfSha256: string): string {
  return `${SEAL_PREFIX}\n${documentId}\n${pdfSha256}`;
}

export function kmsSealer(issuerId: string): Sealer {
  return {
    async seal(message) {
      const r = await signMessage({ issuerId, message });
      return {
        alg: r.algorithm,
        keyId: r.keyId,
        fingerprint: r.fingerprint,
        signature: Buffer.from(r.signature).toString('base64'),
      };
    },
  };
}

let devKey: { privateKey: KeyObject; publicKey: KeyObject; fingerprint: string } | undefined;

function devKeyPair() {
  if (!devKey) {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const spki = publicKey.export({ type: 'spki', format: 'der' });
    // Same shape as KMS fingerprints: SHA256:<base64 of the SPKI DER digest>.
    const fingerprint = `SHA256:${createHash('sha256').update(spki).digest('base64')}`;
    devKey = { privateKey, publicKey, fingerprint };
  }
  return devKey;
}

/** Public half of this process's dev sealing key (for tests and local checks). */
export function devPublicKey(): KeyObject {
  return devKeyPair().publicKey;
}

export function devSealer(): Sealer {
  return {
    async seal(message) {
      const { privateKey, fingerprint } = devKeyPair();
      return {
        alg: 'Ed25519',
        keyId: 'dev-ephemeral',
        fingerprint,
        signature: sign(null, Buffer.from(message, 'utf8'), privateKey).toString('base64'),
      };
    },
  };
}

export function defaultSealer(): Sealer {
  const issuerId = process.env.SEAL_KMS_ISSUER_ID?.trim();
  if (issuerId) return kmsSealer(issuerId);
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error('SEAL_KMS_ISSUER_ID is not set: production refuses to seal signed documents with an ephemeral dev key');
  }
  return devSealer();
}
