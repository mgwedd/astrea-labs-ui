import { unsubscribeWithToken } from '@/lib/email/unsubscribe';

// RFC 8058 one-click target for the List-Unsubscribe header: a mail client POSTs
// "List-Unsubscribe=One-Click" here with no session. GET goes to the confirm page.

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('t');
  const outcome = await unsubscribeWithToken(token);
  if (outcome === 'done') return new Response(null, { status: 200 });
  return new Response(outcome, { status: outcome === 'failed' ? 500 : 400 });
}

export function GET(request: Request) {
  const t = new URL(request.url).searchParams.get('t') ?? '';
  return Response.redirect(new URL(`/email/unsubscribe?t=${encodeURIComponent(t)}`, request.url), 303);
}
