import { checkBotId } from 'botid/server';
import { betaDeps, errType, isSameOriginJson, json, readSessionCookie } from '@/lib/beta-access/server';
import { getSession } from '@/lib/beta-access/service';
import { offerInvite } from '@/lib/accounts/invites';

// "Create an account" after a license request: emails an invite to the address behind the beta
// session, once its email is confirmed. 202 whatever the outcome, so nothing about eligibility leaks.
export async function POST(request: Request) {
  const verdict = await checkBotId();
  if (verdict.isBot) return json({ error: 'blocked' }, 403);
  const deps = betaDeps(request);
  if (!isSameOriginJson(request, deps.siteUrl)) return json({ error: 'invalid' }, 400);

  try {
    const session = await getSession(deps, readSessionCookie(request));
    await offerInvite(deps, session);
  } catch (err) {
    console.error('account invite failed', errType(err));
    return json({ error: 'send_failed' }, 502);
  }
  return json({ ok: true }, 202);
}
