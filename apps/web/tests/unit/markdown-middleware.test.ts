// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth0', () => ({
  auth0: { middleware: async () => NextResponse.next(), getSession: async () => null },
}));

import { middleware } from '../../middleware';

const req = (path: string, host = 'astrealabs.com', accept?: string) =>
  new NextRequest(`https://${host}${path}`, { headers: { host, ...(accept ? { accept } : {}) } });
const rewrite = (res: Response) => res.headers.get('x-middleware-rewrite');

describe('middleware markdown rewrites', () => {
  it('rewrites a .md URL on the apex', async () => {
    const res = await middleware(req('/writing.md'));
    expect(rewrite(res)).toBe('https://astrealabs.com/md/writing');
    expect(res.headers.get('vary')).toBe('Accept');
  });
  it('rewrites a page when the client asks for markdown', async () => {
    expect(rewrite(await middleware(req('/research', 'astrealabs.com', 'text/markdown')))).toBe(
      'https://astrealabs.com/md/research',
    );
  });
  it("serves a subdomain's own project markdown", async () => {
    for (const path of ['/index.md', '/projects/sda.md']) {
      expect(rewrite(await middleware(req(path, 'sda.astrealabs.com')))).toBe('https://sda.astrealabs.com/md/projects/sda');
    }
    expect(rewrite(await middleware(req('/', 'sda.astrealabs.com', 'text/markdown')))).toBe(
      'https://sda.astrealabs.com/md/projects/sda',
    );
  });
  it('sends other markdown on a subdomain to the apex', async () => {
    const res = await middleware(req('/writing.md', 'sda.astrealabs.com'));
    expect(res.headers.get('location')).toBe('https://astrealabs.com/writing.md');
  });
});
