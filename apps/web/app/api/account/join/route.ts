import { errType, sameOrigin } from '@/lib/beta-access/server';
import { licensingDeps, siteUrlFor } from '@/lib/licensing/server';
import { consumeInvite, releaseInvite } from '@/lib/accounts/invites';
import { passwordlessConnection, provisionAccount } from '@/lib/accounts/auth0-mgmt';

const see = (url: string, status = 303) => new Response(null, { status, headers: { Location: url, 'Cache-Control': 'no-store' } });

// The "Create account" button on /account/join. Spends the invite, creates the Auth0 user for the
// invited email, and sends the visitor to the sign-in page, which emails a one-time code. A failure gives the invite back.
export async function POST(request: Request) {
  const siteUrl = siteUrlFor(request);
  // A browser form POST always sends Origin; unlike the JSON routes, a missing one is refused.
  if (!request.headers.get('origin') || !sameOrigin(request, siteUrl)) return new Response(null, { status: 400 });
  const form = await request.formData().catch(() => null);
  const token = form?.get('t');

  const deps = licensingDeps(request);
  const invite = await consumeInvite(deps, token);
  if (!invite.ok) return see(`${siteUrl}/account/join?e=${invite.reason}`);

  try {
    await provisionAccount(invite.email);
    const params = new URLSearchParams({ returnTo: '/account', connection: passwordlessConnection(), login_hint: invite.email });
    return see(`${siteUrl}/auth/login?${params}`);
  } catch (err) {
    console.error('account join failed', errType(err));
    await releaseInvite(deps, invite.inviteId);
    return see(`${siteUrl}/account/join?e=failed&t=${encodeURIComponent(String(token))}`);
  }
}
