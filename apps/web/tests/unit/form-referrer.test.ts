import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// With Referrer-Policy no-referrer, browsers send `Origin: null` on a form POST,
// so the same-origin check rejects the request. Pages that POST a form use
// same-origin instead, which still keeps the URL's token from other sites.
const root = join(__dirname, '../../app');

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return name === 'page.tsx' ? [path] : [];
  });
}

describe('pages that POST a form', () => {
  const posting = pages(root).filter((p) => /<form[^>]*method="post"/i.test(readFileSync(p, 'utf8')));

  it('finds the signing and join pages', () => {
    expect(posting.some((p) => p.includes('beta/sign/page.tsx'))).toBe(true);
    expect(posting.some((p) => p.includes('account/join/page.tsx'))).toBe(true);
  });

  it.each(posting)('%s keeps the Origin header', (path) => {
    expect(readFileSync(path, 'utf8')).not.toContain("referrer: 'no-referrer'");
  });
});
