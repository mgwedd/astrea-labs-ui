import { notFound } from 'next/navigation';
import { getMarkdownPage, markdownPages } from '@/lib/markdown';
import { site } from '@/lib/site';

// Served at `<page>.md` and for `Accept: text/markdown` via a middleware rewrite.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return markdownPages().map((p) => ({ path: p.path === '/' ? [] : p.path.slice(1).split('/') }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const pagePath = path?.length ? `/${path.join('/')}` : '/';
  const page = getMarkdownPage(pagePath);
  if (!page) notFound();
  return new Response(page.render(), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
      Link: `<${site.url}${pagePath === '/' ? '' : pagePath}>; rel="canonical"`,
    },
  });
}
