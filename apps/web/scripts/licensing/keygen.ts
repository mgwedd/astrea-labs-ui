// Generates an Ed25519 signing key for Aletheia licenses.
//
//   node scripts/licensing/keygen.ts <kid> | vercel env add LICENSE_SIGNING_SEED production --sensitive
//
// The seed goes to stdout only, so it can be piped straight into Vercel without
// appearing on screen. The kid and public key (safe to share) go to stderr.
import { generateKeyPairSync } from 'node:crypto';
import { rawPublicKey } from '../../lib/licensing/token.ts';

const kid = process.argv[2];
if (!kid || !/^[a-z0-9-]{3,32}$/.test(kid)) {
  console.error('usage: node scripts/licensing/keygen.ts <kid>   (kid: 3-32 chars, a-z 0-9 -)');
  process.exit(1);
}

const { privateKey } = generateKeyPairSync('ed25519');
const jwk = privateKey.export({ format: 'jwk' });
const seed = Buffer.from(jwk.d as string, 'base64url').toString('base64');

console.error(JSON.stringify({ kid, publicKey: rawPublicKey(privateKey) }, null, 2));
process.stdout.write(seed);
