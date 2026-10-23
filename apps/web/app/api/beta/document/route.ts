import { betaDeps, errType, json, readSessionCookie } from '@/lib/beta-access/server';
import { getDocument } from '@/lib/beta-access/service';

// The PDF for the current beta session: the unsigned draft while signing
// (fetching it records the document as viewed), the signed copy afterwards.
// Both are checked against their stored SHA-256 before they are served.
export async function GET(request: Request) {
  const deps = betaDeps(request);
  try {
    const r = await getDocument(deps, readSessionCookie(request));
    if (!r.ok) {
      if (r.reason === 'session') return json({ error: 'session' }, 401);
      console.error('beta document unavailable', r.reason);
      return json({ error: 'unavailable' }, 502);
    }
    const download = new URL(request.url).searchParams.get('download') === '1';
    return new Response(Buffer.from(r.bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${r.filename}"`,
        'Content-Length': String(r.bytes.byteLength),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('beta document failed', errType(err));
    return json({ error: 'unavailable' }, 502);
  }
}
