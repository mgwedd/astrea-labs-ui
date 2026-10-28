import { checkBotId } from 'botid/server';
import { after } from 'next/server';
import { isSameOriginJson, requestMeta } from '@/lib/beta-access/server';
import { LicenseRequestBody } from '@/lib/licensing/request';
import { licensingDeps, siteUrlFor } from '@/lib/licensing/server';
import { requestLicense } from '@/lib/licensing/service';

const headers = { 'Cache-Control': 'no-store' };

// "Lost my license": emails a single-use key link if the address has an active
// license, and nothing otherwise. The reply is 202 whether the address is
// licensed, unknown or rate-limited, so it reveals nothing.
export async function POST(request: Request) {
  if (!isSameOriginJson(request, siteUrlFor(request))) return Response.json({ error: 'Request blocked.' }, { status: 403, headers });
  const verdict = await checkBotId();
  if (verdict.isBot) return Response.json({ error: 'Request blocked.' }, { status: 403, headers });

  const parsed = LicenseRequestBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Enter a valid email address.' }, { status: 400, headers });

  const deps = licensingDeps(request);
  const { ip } = requestMeta(request);
  // Runs after the reply is sent, so the response time doesn't show whether the address has a license.
  after(async () => {
    try {
      const outcome = await requestLicense(deps, { email: parsed.data.email, ip });
      // The outcome only, never the address.
      console.info('license request', outcome);
    } catch (err) {
      // Log the error type only: Drizzle error messages include query params (the email).
      console.error('license request failed', err instanceof Error ? err.name : typeof err);
    }
  });
  return Response.json({ ok: true }, { status: 202, headers });
}
