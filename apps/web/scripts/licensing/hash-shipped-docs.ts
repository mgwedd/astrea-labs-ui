// Writes lib/licensing/shipped-docs.json from the app's shipped documents.
//
//   node scripts/licensing/hash-shipped-docs.ts <version> <TERMS.md> <PRIVACY.md>
//
// The hash is over the file's exact bytes, so run it on the files the app
// ships, at the commit the release is built from.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashDocument } from '../../lib/licensing/token.ts';

const [version, termsPath, privacyPath] = process.argv.slice(2);
if (!version || !termsPath || !privacyPath) {
  console.error('usage: hash-shipped-docs.ts <version> <TERMS.md> <PRIVACY.md>');
  process.exit(1);
}

const entry = (path: string) => ({ version, sha256: hashDocument(readFileSync(path)) });
const out = fileURLToPath(new URL('../../lib/licensing/shipped-docs.json', import.meta.url));
writeFileSync(out, JSON.stringify({ terms: entry(termsPath), privacy: entry(privacyPath) }, null, 2) + '\n');
console.log(`wrote ${out}`);
