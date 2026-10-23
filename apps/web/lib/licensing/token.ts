// Aletheia license tokens and revocation lists.
//
// Format (see the Aletheia licensing contract):
//   license:     ALET1.<payload>.<signature>
//   revocations: ALETR1.<payload>.<signature>
// payload   = base64url (no padding) of UTF-8 JSON
// signature = base64url (no padding) of Ed25519 over the ASCII bytes "<prefix>.<payload>"
//
// This file only depends on node:crypto so scripts can import it directly.
import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';

export const LICENSE_PREFIX = 'ALET1';
export const REVOCATIONS_PREFIX = 'ALETR1';
export const MAX_TOKEN_BYTES = 1024;
export const MAX_REVOCATIONS_BYTES = 256 * 1024;

export type LicensePayload = {
  v: 1;
  kid: string;
  lid: string;
  sub: string;
  tier: 'beta';
  iat: number;
  /** Unix seconds. Omitted: the license never expires. */
  exp?: number;
};

export type RevocationsPayload = {
  v: 1;
  kid: string;
  iat: number;
  next: number;
  revoked: string[];
};

export type SigningKey = { kid: string; privateKey: KeyObject };

// PKCS#8 DER header for an Ed25519 private key; the 32-byte seed follows it.
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
// SPKI DER header for an Ed25519 public key; the 32-byte key follows it.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function b64url(data: Uint8Array | string): string {
  return Buffer.from(data).toString('base64url');
}

/** Ed25519 private key from its 32-byte seed (base64 or base64url). */
export function privateKeyFromSeed(seed: string): KeyObject {
  const raw = Buffer.from(seed, 'base64');
  if (raw.length !== 32) throw new Error('Ed25519 seed must be 32 bytes');
  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, raw]),
    format: 'der',
    type: 'pkcs8',
  });
}

/** Ed25519 public key from its raw 32 bytes (standard base64). */
export function publicKeyFromRaw(raw: string): KeyObject {
  const bytes = Buffer.from(raw, 'base64');
  if (bytes.length !== 32) throw new Error('Ed25519 public key must be 32 bytes');
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, bytes]),
    format: 'der',
    type: 'spki',
  });
}

/** The raw 32-byte public key, standard base64. This is what the app embeds. */
export function rawPublicKey(key: KeyObject): string {
  const pub = key.type === 'private' ? createPublicKey(key) : key;
  const der = pub.export({ format: 'der', type: 'spki' });
  return der.subarray(ED25519_SPKI_PREFIX.length).toString('base64');
}

function signParts(prefix: string, payload: object, privateKey: KeyObject): string {
  const signed = `${prefix}.${b64url(JSON.stringify(payload))}`;
  const signature = sign(null, Buffer.from(signed, 'ascii'), privateKey);
  return `${signed}.${b64url(signature)}`;
}

export function signLicense(payload: LicensePayload, key: SigningKey): string {
  if (payload.kid !== key.kid) throw new Error('payload kid does not match signing key');
  const token = signParts(LICENSE_PREFIX, payload, key.privateKey);
  if (Buffer.byteLength(token) > MAX_TOKEN_BYTES) throw new Error('license token over 1 KB');
  return token;
}

export function signRevocations(payload: RevocationsPayload, key: SigningKey): string {
  if (payload.kid !== key.kid) throw new Error('payload kid does not match signing key');
  const body = signParts(REVOCATIONS_PREFIX, payload, key.privateKey);
  if (Buffer.byteLength(body) > MAX_REVOCATIONS_BYTES) throw new Error('revocation list over 256 KB');
  return body;
}

export type VerifyFailure = 'malformed' | 'bad_signature' | 'unknown_kid' | 'bad_version' | 'expired' | 'future_iat';

/**
 * Verifies a token the way the app does. The server never needs this to issue;
 * it exists for tests, fixtures and admin checks.
 */
export function verifySigned<T extends { v: number; kid: string }>(
  prefix: string,
  token: string,
  publicKeys: Record<string, KeyObject>,
): { ok: true; payload: T } | { ok: false; reason: VerifyFailure } {
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== prefix) return { ok: false, reason: 'malformed' };
  let payload: T;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as T;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof payload !== 'object' || payload === null || typeof payload.kid !== 'string') {
    return { ok: false, reason: 'malformed' };
  }
  const key = Object.hasOwn(publicKeys, payload.kid) ? publicKeys[payload.kid] : undefined;
  if (!key) return { ok: false, reason: 'unknown_kid' };
  const signed = Buffer.from(`${parts[0]}.${parts[1]}`, 'ascii');
  if (!verify(null, signed, key, Buffer.from(parts[2], 'base64url'))) {
    return { ok: false, reason: 'bad_signature' };
  }
  if (payload.v !== 1) return { ok: false, reason: 'bad_version' };
  return { ok: true, payload };
}

export function verifyLicense(
  token: string,
  publicKeys: Record<string, KeyObject>,
  nowSeconds: number,
): { ok: true; payload: LicensePayload } | { ok: false; reason: VerifyFailure } {
  const result = verifySigned<LicensePayload>(LICENSE_PREFIX, token, publicKeys);
  if (!result.ok) return result;
  const { exp } = result.payload;
  if (exp !== undefined && typeof exp !== 'number') return { ok: false, reason: 'malformed' };
  if (exp !== undefined && exp < nowSeconds) return { ok: false, reason: 'expired' };
  if (result.payload.iat > nowSeconds + 86_400) return { ok: false, reason: 'future_iat' };
  return result;
}
