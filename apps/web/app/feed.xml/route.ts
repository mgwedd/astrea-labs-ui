import { getPosts } from '@/lib/writing';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function GET() {
  const posts = getPosts();
  const lastBuild = posts[0] && new Date(`${posts[0].date}T00:00:00Z`).toUTCString();
  const items = posts
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${site.url}/writing/${p.slug}</link>
      <guid>${site.url}/writing/${p.slug}</guid>
      <pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate>
      <description>${esc(p.summary)}</description>
      <dc:creator>${esc(site.founder)}</dc:creator>
    </item>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${site.name}</title>
    <link>${site.url}</link>
    <description>${esc(site.description)}</description>
    <language>en-us</language>
    <atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml" />
${lastBuild ? `    <lastBuildDate>${lastBuild}</lastBuildDate>\n` : ''}${items}
  </channel>
</rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
