import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Beta and privacy copy names Astrea Labs as the party, not a person.
// Biographical pages (about, lib/site.ts) are out of scope.
const FILES = [
  'components/beta/privacy-notice.tsx',
  'app/(site)/aletheia/beta/page.tsx',
  'app/(site)/aletheia/beta/signed/page.tsx',
];

describe('beta copy names Astrea Labs, not an individual', () => {
  for (const file of FILES) {
    it(file, () => {
      const src = readFileSync(join(__dirname, '../../..', file), 'utf8');
      expect(src).not.toMatch(/Michael|Christopher/);
    });
  }
});
