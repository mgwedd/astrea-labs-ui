import { getDb } from '@/lib/licensing/db/client';
import { getSigningKey } from '@/lib/licensing/keys';
import { buildRevocationList } from '@/lib/licensing/service';

// The signed revocation list the Aletheia helper fetches (at most daily).
// Same bytes for every caller: no cookies or auth are read, and
// nothing about the request (IP included) is logged or stored.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // A query string would get its own CDN cache entry and a fresh DB read.
  const url = new URL(request.url);
  if (url.search) return Response.redirect(new URL(url.pathname, url), 301);
  try {
    const body = await buildRevocationList({ db: getDb(), key: getSigningKey() });
    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        // Vercel's CDN refreshes sooner than clients so a revocation shows up within minutes.
        'CDN-Cache-Control': 'public, max-age=300, stale-if-error=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    // The app keeps its last accepted list, so failing closed here is safe.
    return new Response('unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
