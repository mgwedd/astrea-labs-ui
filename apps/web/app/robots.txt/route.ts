import { site } from '@/lib/site';

// A route handler instead of robots.ts, because MetadataRoute.Robots can't carry the llms.txt line.
export const dynamic = 'force-static';

export function GET() {
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${site.url}/sitemap.xml`, '', `# LLM-readable index: ${site.url}/llms.txt`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
