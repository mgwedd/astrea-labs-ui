import type { Metadata } from 'next';
import { site } from './site';

/** Internal route that serves markdown. Middleware rewrites `.md` URLs and `Accept: text/markdown` here. */
export const MARKDOWN_ROUTE = '/md';

/** Public paths that have a markdown version (before checking the slug exists). */
const MARKDOWN_SECTIONS = /^\/(?:projects(?:\/[a-z0-9-]+)?|writing(?:\/[a-z0-9-]+)?|research|about)?$/;

/** `/` → `/index.md`, `/writing/x` → `/writing/x.md`. */
export const markdownPath = (path: string) => (path === '/' ? '/index.md' : `${path}.md`);

export const markdownUrl = (path: string) => `${site.url}${markdownPath(path)}`;

export const wantsMarkdown = (accept: string | null) => !!accept && /(^|,)\s*text\/markdown/i.test(accept);

/**
 * The internal path to rewrite a request to, or null to leave it alone.
 * `.md` URLs always map; other URLs map only when the client asks for markdown.
 */
export function markdownRewrite(pathname: string, accept: string | null): string | null {
  let path: string;
  if (pathname.endsWith('.md')) {
    path = pathname === '/index.md' ? '/' : pathname.slice(0, -3);
  } else if (wantsMarkdown(accept)) {
    path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  } else {
    return null;
  }
  if (!MARKDOWN_SECTIONS.test(path)) return null;
  return path === '/' ? MARKDOWN_ROUTE : `${MARKDOWN_ROUTE}${path}`;
}

/** `alternates` metadata for a page with a markdown version. Keeps the site-wide RSS link. */
export const markdownAlternates = (path: string): Metadata['alternates'] => ({
  types: { 'application/rss+xml': '/feed.xml', 'text/markdown': markdownPath(path) },
});
