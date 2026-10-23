import 'server-only';
import { privateKeyFromSeed, type SigningKey } from './token';

let cached: SigningKey | undefined;

/**
 * The active signing key, from two env vars:
 *   LICENSE_SIGNING_KID  - key id embedded in tokens, e.g. "alet-2026a"
 *   LICENSE_SIGNING_SEED - 32-byte Ed25519 seed, base64 (mark Sensitive on Vercel)
 * Vercel KMS has no Ed25519 keys, so the seed lives in a sensitive env var.
 */
export function getSigningKey(): SigningKey {
  if (cached) return cached;
  const kid = process.env.LICENSE_SIGNING_KID;
  const seed = process.env.LICENSE_SIGNING_SEED;
  if (!kid || !seed) throw new Error('LICENSE_SIGNING_KID and LICENSE_SIGNING_SEED must be set');
  cached = { kid, privateKey: privateKeyFromSeed(seed) };
  return cached;
}
