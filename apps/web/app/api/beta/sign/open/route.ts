import { betaDeps, errType, NO_STORE, sameOrigin, sessionCookie } from '@/lib/beta-access/server';
import { openSigningLink } from '@/lib/beta-access/service';

const SIGN_PAGE = '/aletheia/beta/sign';

const redirect = (location: string, cookie?: string) =>
  new Response(null, {
    status: 303,
    headers: { ...NO_STORE, Location: location, ...(cookie ? { 'Set-Cookie': cookie } : {}) },
  });

// The confirm page POSTs the emailed token here (form-encoded "t"), so link
// scanners that only GET the email link don't consume it. Success sets the
// signing-session cookie and returns to the sign page.
export async function POST(request: Request) {
  const deps = betaDeps(request);
  if (!sameOrigin(request, deps.siteUrl)) return redirect(`${SIGN_PAGE}?e=invalid`);
  const form = await request.formData().catch(() => null);
  const t = form?.get('t');
  if (typeof t !== 'string') return redirect(`${SIGN_PAGE}?e=invalid`);
  try {
    const r = await openSigningLink(deps, t);
    if (!r.ok) return redirect(`${SIGN_PAGE}?e=${r.reason}`);
    const maxAge = (r.expiresAt.getTime() - Date.now()) / 1000;
    return redirect(SIGN_PAGE, sessionCookie(r.sessionToken, maxAge));
  } catch (err) {
    console.error('beta sign link open failed', errType(err));
    // The link is only consumed after the document is stored, so it still works.
    return redirect(`${SIGN_PAGE}?e=unavailable`);
  }
}
