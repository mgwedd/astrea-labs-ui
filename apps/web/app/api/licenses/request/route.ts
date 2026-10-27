import { checkBotId } from 'botid/server';
import { z } from 'zod';
import { isSameOriginJson } from '@/lib/beta-access/server';
import { licensingDeps, siteUrlFor } from '@/lib/licensing/server';
import { requestLicense } from '@/lib/licensing/service';

const Body = z.object({ email: z.email().max(254) });
const headers = { 'Cache-Control': 'no-store' };

// "Lost my license": emails a single-use key link if the address has an active
// license, and nothing otherwise. The reply is 202 whether the address is
// licensed, unknown, blocked or rate-limited, so it reveals nothing.
export async function POST(request: Request) {
  if (!isSameOriginJson(request, siteUrlFor(request))) return Response.json({ error: 'Request blocked.' }, { status: 403, headers });
  const verdict = await checkBotId();
  if (verdict.isBot) return Response.json({ error: 'Request blocked.' }, { status: 403, headers });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Enter a valid email address.' }, { status: 400, headers });

  try {
    await requestLicense(licensingDeps(request), { email: parsed.data.email });
  } catch (err) {
    // Log the error type only: Drizzle error messages include query params (the email).
    console.error('license request failed', err instanceof Error ? err.name : typeof err);
  }
  return Response.json({ ok: true }, { status: 202, headers });
}
