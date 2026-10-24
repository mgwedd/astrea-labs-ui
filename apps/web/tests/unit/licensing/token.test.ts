// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import fixtures from '../../fixtures/licensing/fixtures.json';
import {
  hashDocument,
  MAX_TOKEN_BYTES,
  CLAIM_CODES,
  type LicensePayload,
  publicKeyFromRaw,
  privateKeyFromSeed,
  rawPublicKey,
  REVOCATIONS_PREFIX,
  signLicense,
  verifyLicense,
  verifySigned,
  type RevocationsPayload,
} from '@/lib/licensing/token';

const keys = Object.fromEntries(Object.entries(fixtures.publicKeys).map(([kid, raw]) => [kid, publicKeyFromRaw(raw)]));

describe('fixtures', () => {
  it('valid token verifies', () => {
    const r = verifyLicense(fixtures.tokens.valid, keys, fixtures.now);
    expect(r.ok).toBe(true);
  });

  it('perpetual token has no exp and verifies at any later time', () => {
    for (const now of [fixtures.now, fixtures.now + 1000 * 365 * 86_400]) {
      const r = verifyLicense(fixtures.tokens.perpetual, keys, now);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.payload).not.toHaveProperty('exp');
    }
  });

  it.each([
    ['expired', 'expired'],
    ['badSignature', 'bad_signature'],
    ['unknownKid', 'unknown_kid'],
  ] as const)('%s token fails with %s', (name, reason) => {
    expect(verifyLicense(fixtures.tokens[name], keys, fixtures.now)).toEqual({ ok: false, reason });
  });

  it('revoked token verifies but is named on the signed revocation list', () => {
    const lic = verifyLicense(fixtures.tokens.revoked, keys, fixtures.now);
    const list = verifySigned<RevocationsPayload>(REVOCATIONS_PREFIX, fixtures.revocations, keys);
    expect(lic.ok && list.ok).toBe(true);
    if (lic.ok && list.ok) expect(list.payload.revoked).toContain(lic.payload.lid);
  });

  it('tokens are one line and at most 1 KB', () => {
    for (const t of Object.values(fixtures.tokens)) {
      expect(t).not.toMatch(/\s/);
      expect(Buffer.byteLength(t)).toBeLessThanOrEqual(1024);
    }
  });
});

describe('token format', () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const key = { kid: 'k1', privateKey };
  const pub = { k1: publicKeyFromRaw(rawPublicKey(privateKey)) };
  const payload = { v: 1, kid: 'k1', lid: '00000000-0000-4000-8000-000000000000', sub: 'a@b.c', tier: 'beta', iat: 1000, exp: 2000 } as const;

  it('is ALET1.<b64url json>.<b64url sig> with the signature over the prefix and payload', () => {
    const token = signLicense(payload, key);
    const [prefix, body, sig] = token.split('.');
    expect(prefix).toBe('ALET1');
    expect(body).not.toMatch(/[=+/]/);
    expect(sig).not.toMatch(/[=+/]/);
    expect(JSON.parse(Buffer.from(body, 'base64url').toString())).toEqual(payload);
    expect(Buffer.from(sig, 'base64url')).toHaveLength(64);
  });

  it('rejects iat more than a day in the future, accepts within a day', () => {
    const token = signLicense({ ...payload, iat: 100_000 + 86_401, exp: 10_000_000 }, key);
    expect(verifyLicense(token, pub, 100_000)).toEqual({ ok: false, reason: 'future_iat' });
    const ok = signLicense({ ...payload, iat: 100_000 + 86_400, exp: 10_000_000 }, key);
    expect(verifyLicense(ok, pub, 100_000).ok).toBe(true);
  });

  it('rejects a non-numeric exp as malformed', () => {
    const token = signLicense({ ...payload, exp: '2000' as unknown as number }, key);
    expect(verifyLicense(token, pub, 1500)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects v != 1', () => {
    const token = signLicense({ ...payload, v: 2 as 1, exp: 10_000_000 }, key);
    expect(verifyLicense(token, pub, 1500)).toEqual({ ok: false, reason: 'bad_version' });
  });

  it('round-trips a seed', () => {
    const seed = Buffer.from(privateKey.export({ format: 'jwk' }).d as string, 'base64url').toString('base64');
    expect(rawPublicKey(privateKeyFromSeed(seed))).toBe(rawPublicKey(privateKey));
  });

  it('public key is raw 32 bytes', () => {
    expect(Buffer.from(rawPublicKey(privateKey), 'base64')).toHaveLength(32);
  });
});

describe('terms acceptance and claims', () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const key = { kid: 'k1', privateKey };
  const pub = { k1: publicKeyFromRaw(rawPublicKey(privateKey)) };
  const base: LicensePayload = { v: 1, kid: 'k1', lid: '00000000-0000-4000-8000-000000000000', sub: 'a@b.c', tier: 'beta', iat: 1000, exp: 2000 };
  const acc: NonNullable<LicensePayload['acc']> = [
    { d: 'terms', v: '2026-10-24', h: hashDocument('terms'), at: 1_792_000_000 },
    { d: 'privacy', v: '2026-10-24', h: hashDocument('privacy'), at: 1_792_000_000 },
  ];

  it('hashes the exact UTF-8 bytes (known SHA-256)', () => {
    expect(hashDocument('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hashDocument(Buffer.from('abc', 'utf8'))).toBe(hashDocument('abc'));
    expect(hashDocument('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('round-trips acc and cl', () => {
    const payload: LicensePayload = { ...base, acc, cl: ['no-baa', 'beta-no-sla'] };
    const r = verifyLicense(signLicense(payload, key), pub, 1500);
    expect(r.ok && r.payload).toEqual(payload);
  });

  it('round-trips a payload without them, and tokens without them stay valid', () => {
    const r = verifyLicense(signLicense(base, key), pub, 1500);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload).not.toHaveProperty('acc');
      expect(r.payload).not.toHaveProperty('cl');
    }
  });

  it('rejects unknown claim codes and duplicates at mint time', () => {
    expect(() => signLicense({ ...base, cl: ['no-baa', 'made-up' as never] }, key)).toThrow(/unknown claim/);
    expect(() => signLicense({ ...base, cl: ['no-baa', 'no-baa'] }, key)).toThrow(/duplicate claim/);
    expect(CLAIM_CODES).toEqual(['no-baa', 'beta-no-sla']);
  });

  it('rejects malformed acc entries at mint time', () => {
    const bad = (e: object) => () => signLicense({ ...base, acc: [{ ...acc[0], ...e } as never] }, key);
    expect(bad({ d: 'eula' })).toThrow(/unknown acc document/);
    expect(bad({ h: 'ABC' })).toThrow(/hash/);
    expect(bad({ h: hashDocument('x').toUpperCase() })).toThrow(/hash/);
    expect(bad({ v: '' })).toThrow(/version/);
    expect(bad({ at: 1.5 })).toThrow(/time/);
    expect(() => signLicense({ ...base, acc: [acc[0], acc[0]] }, key)).toThrow(/duplicate acc/);
  });

  it('fits in MAX_TOKEN_BYTES with both acc entries, both claims, a UUID lid and a long email', () => {
    const payload: LicensePayload = {
      ...base,
      lid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      sub: 'a.very.long.clinician.email.address@some-practice-name.example.com',
      iat: 4_102_444_800,
      exp: 4_102_444_800 + 180 * 86_400,
      acc,
      cl: ['no-baa', 'beta-no-sla'],
    };
    expect(Buffer.byteLength(signLicense(payload, key))).toBeLessThanOrEqual(MAX_TOKEN_BYTES);
  });

  it('shared fixtures: withTerms carries acc and cl that match the documents; valid is the old shape', () => {
    const withTerms = verifyLicense(fixtures.tokens.withTerms, keys, fixtures.now);
    expect(withTerms.ok).toBe(true);
    if (!withTerms.ok) return;
    expect(withTerms.payload.cl).toEqual(['no-baa', 'beta-no-sla']);
    for (const a of withTerms.payload.acc!) {
      const doc = fixtures.documents[a.d];
      expect(a).toMatchObject({ v: doc.version, h: doc.sha256 });
      expect(hashDocument(doc.text)).toBe(a.h);
    }
    const old = verifyLicense(fixtures.tokens.valid, keys, fixtures.now);
    expect(old.ok && 'acc' in old.payload).toBe(false);
  });
});
