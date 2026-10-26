// Writes test fixtures for the Aletheia app's license unit tests.
//
//   node scripts/licensing/make-fixtures.ts
//
// Uses throwaway keys generated on each run. Only public keys and signed
// tokens are written; the private keys are never saved.
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  hashDocument,
  rawPublicKey,
  signLicense,
  signRevocations,
  type LicensePayload,
  type SigningKey,
} from '../../lib/licensing/token.ts';

const testKey: SigningKey = { kid: 'test-1', privateKey: generateKeyPairSync('ed25519').privateKey };
// Signs correctly, but its kid is not in the app's key set.
const strayKey: SigningKey = { kid: 'test-unknown', privateKey: generateKeyPairSync('ed25519').privateKey };

const DAY = 86_400;
const FAR_IAT = 4_102_444_800; // 2100-01-01: valid for any realistic test clock
const PAST_IAT = 1_735_689_600; // 2025-01-01

// Most fixtures have an exp so expiry is exercised; "perpetual" has none.
function license(key: SigningKey, iat: number, sub: string, expires = true): { lid: string; token: string } {
  const payload: LicensePayload = { v: 1, kid: key.kid, lid: randomUUID(), sub, tier: 'beta', iat };
  if (expires) payload.exp = iat + 90 * DAY;
  return { lid: payload.lid, token: signLicense(payload, key) };
}

// "valid" is iat 2100 so the token never expires in tests. That is more than a
// day in the future for today's clock, so tests must pin "now" near FAR_IAT.
const valid = license(testKey, FAR_IAT, 'valid@example.com');
const expired = license(testKey, PAST_IAT, 'expired@example.com');
// No exp, and issued in the past: valid at any later clock.
const perpetual = license(testKey, PAST_IAT, 'perpetual@example.com', false);
const unknownKid = license(strayKey, FAR_IAT, 'unknown-kid@example.com');
// Same shape as a freshly minted beta token: accepted documents plus fixed claims.
const FIXTURE_DOCS = {
  terms: { version: '2100-01-01', text: 'Fixture terms of service.\n' },
  privacy: { version: '2100-01-01', text: 'Fixture privacy policy.\n' },
};
const ACCEPTED_AT = FAR_IAT - 3600;
const withTermsPayload: LicensePayload = {
  v: 1,
  kid: testKey.kid,
  lid: randomUUID(),
  sub: 'with-terms@example.com',
  tier: 'beta',
  iat: FAR_IAT,
  exp: FAR_IAT + 90 * DAY,
  acc: [
    { d: 'terms', v: FIXTURE_DOCS.terms.version, h: hashDocument(FIXTURE_DOCS.terms.text), at: ACCEPTED_AT },
    { d: 'privacy', v: FIXTURE_DOCS.privacy.version, h: hashDocument(FIXTURE_DOCS.privacy.text), at: ACCEPTED_AT },
  ],
  cl: ['no-baa', 'beta-no-sla'],
};
const withTerms = signLicense(withTermsPayload, testKey);
const revoked = license(testKey, FAR_IAT, 'revoked@example.com');

// Flip one byte of the decoded signature, then re-encode.
const [prefix, payload, sig] = license(testKey, FAR_IAT, 'bad-signature@example.com').token.split('.');
const sigBytes = Buffer.from(sig, 'base64url');
sigBytes[0] ^= 0xff;
const badSignature = `${prefix}.${payload}.${sigBytes.toString('base64url')}`;

const revocationsIat = FAR_IAT + DAY;
const revocations = signRevocations(
  { v: 1, kid: testKey.kid, iat: revocationsIat, next: revocationsIat + 3600, revoked: [revoked.lid] },
  testKey,
);

const fixtures = {
  note: 'Test-only keys. Pin the test clock to `now` (2100-01-02). `valid` has no acc/cl (old shape); `withTerms` has both. Regenerate with scripts/licensing/make-fixtures.ts.',
  now: revocationsIat,
  publicKeys: { [testKey.kid]: rawPublicKey(testKey.privateKey) },
  tokens: {
    valid: valid.token,
    withTerms,
    expired: expired.token,
    perpetual: perpetual.token,
    badSignature,
    unknownKid: unknownKid.token,
    revoked: revoked.token,
  },
  // Documents behind withTerms.acc: h is the SHA-256 of `text` as UTF-8 bytes.
  documents: {
    terms: { ...FIXTURE_DOCS.terms, sha256: hashDocument(FIXTURE_DOCS.terms.text) },
    privacy: { ...FIXTURE_DOCS.privacy, sha256: hashDocument(FIXTURE_DOCS.privacy.text) },
  },
  withTermsPayload,
  revokedLid: revoked.lid,
  revocations,
};

const out = fileURLToPath(new URL('../../tests/fixtures/licensing/fixtures.json', import.meta.url));
writeFileSync(out, JSON.stringify(fixtures, null, 2) + '\n');
console.log(`wrote ${out}`);
