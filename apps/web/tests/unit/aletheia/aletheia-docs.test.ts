// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { docFromBytes, getLegalDocs, parseVersion, rewriteLink } from '@/lib/aletheia-docs';

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const bytes = (s: string) => new TextEncoder().encode(s);
const doc = (version: string, extra = '') => `# Title\n\n_Last updated: ${version}_\n\nBody ${extra}\n`;

function stubFetch(files: Record<string, Uint8Array | number>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: { next?: { revalidate?: number; tags?: string[] } }) => {
      calls.push(url);
      const name = url.split('/').at(-1)!;
      const file = files[name];
      if (typeof file === 'number') return new Response('nope', { status: file });
      if (!file) return new Response('missing', { status: 404 });
      expect(init?.next?.revalidate).toBe(3600);
      expect(init?.next?.tags).toContain('aletheia-docs');
      return new Response(file as BodyInit, { status: 200 });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('parseVersion', () => {
  it('reads the _Last updated_ line', () => {
    expect(parseVersion(doc('2026-10-25'))).toBe('2026-10-25');
    expect(parseVersion('# T\r\n\r\n_Last updated: 2026-10-25_\r\n')).toBe('2026-10-25');
  });

  it('throws without a strict match', () => {
    for (const bad of [
      '# T\n',
      '# T\n\nLast updated: 2026-10-25\n',
      '# T\n\n_Last updated: 26-10-25_\n',
      '# T\n\n_Last updated: 2026-13-45_\n',
      '# T\n\n_Last updated: 2026-10-25_ and more\n',
      '# T\n\ntext _Last updated: 2026-10-25_\n',
    ]) {
      expect(() => parseVersion(bad), bad).toThrow();
    }
  });
});

describe('docFromBytes', () => {
  it('hashes the exact bytes, including ones a text round trip would change', () => {
    const raw = new Uint8Array([...bytes('# T\n\n_Last updated: 2026-10-25_\n\n'), 0xef, 0xbb, 0xbf, 0x0d, 0x0a, ...bytes('é')]);
    const d = docFromBytes(raw);
    expect(d.sha256).toBe(sha(raw));
    expect(d.version).toBe('2026-10-25');
    expect(d.sha256).not.toBe(sha(bytes(d.markdown.replace(/\r\n/g, '\n'))));
  });

  it('rejects bytes that are not UTF-8', () => {
    expect(() => docFromBytes(new Uint8Array([0xff, 0xfe, 0xfd]))).toThrow();
  });
});

describe('getLegalDocs', () => {
  it('fetches TERMS.md and PRIVACY.md from the Aletheia repo and returns one version', async () => {
    const terms = bytes(doc('2026-10-25', 'terms'));
    const privacy = bytes(doc('2026-10-25', 'privacy'));
    const calls = stubFetch({ 'TERMS.md': terms, 'PRIVACY.md': privacy });
    const legal = await getLegalDocs();
    expect(legal.version).toBe('2026-10-25');
    expect(legal.terms.sha256).toBe(sha(terms));
    expect(legal.privacy.sha256).toBe(sha(privacy));
    expect(legal.terms.markdown).toContain('Body terms');
    expect(calls.sort()).toEqual([
      'https://raw.githubusercontent.com/mgwedd/aletheia/main/PRIVACY.md',
      'https://raw.githubusercontent.com/mgwedd/aletheia/main/TERMS.md',
    ]);
  });

  it('throws when the two versions differ', async () => {
    stubFetch({ 'TERMS.md': bytes(doc('2026-10-25')), 'PRIVACY.md': bytes(doc('2026-10-24')) });
    await expect(getLegalDocs()).rejects.toThrow(/differ/);
  });

  it('throws when a fetch fails', async () => {
    stubFetch({ 'TERMS.md': bytes(doc('2026-10-25')), 'PRIVACY.md': 500 });
    await expect(getLegalDocs()).rejects.toThrow(/PRIVACY\.md.*500/);
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('network down'))));
    await expect(getLegalDocs()).rejects.toThrow('network down');
  });

  it('throws when a document has no version line', async () => {
    stubFetch({ 'TERMS.md': bytes('# Terms\n'), 'PRIVACY.md': bytes(doc('2026-10-25')) });
    await expect(getLegalDocs()).rejects.toThrow(/Last updated/);
  });
});

describe('rewriteLink', () => {
  const blob = 'https://github.com/mgwedd/aletheia/blob/main';

  it('maps TERMS.md and PRIVACY.md to the site pages', () => {
    expect(rewriteLink('TERMS.md')).toBe('/aletheia/terms');
    expect(rewriteLink('./PRIVACY.md')).toBe('/aletheia/privacy');
    expect(rewriteLink('PRIVACY.md#data')).toBe('/aletheia/privacy#data');
  });

  it('maps other relative paths to the Aletheia repo', () => {
    expect(rewriteLink('LICENSE')).toBe(`${blob}/LICENSE`);
    expect(rewriteLink('SECURITY.md')).toBe(`${blob}/SECURITY.md`);
    expect(rewriteLink('docs/a b.md#x')).toBe(`${blob}/docs/a%20b.md#x`);
    expect(rewriteLink('/THIRD-PARTY-NOTICES.md')).toBe(`${blob}/THIRD-PARTY-NOTICES.md`);
    expect(rewriteLink('../../etc/passwd')).toBe(`${blob}/etc/passwd`);
  });

  it('keeps fragments, http(s) and mailto, and drops anything else', () => {
    expect(rewriteLink('#section')).toBe('#section');
    expect(rewriteLink('https://example.com/x')).toBe('https://example.com/x');
    expect(rewriteLink('mailto:a@b.co')).toBe('mailto:a@b.co');
    expect(rewriteLink('javascript:alert(1)')).toBeUndefined();
    expect(rewriteLink('data:text/html,x')).toBeUndefined();
    expect(rewriteLink('//evil.example/x')).toBeUndefined();
    expect(rewriteLink(undefined)).toBeUndefined();
  });
});
