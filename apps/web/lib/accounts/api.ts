import 'server-only';
import { ApiClient } from '@auth0/auth0-api-js';
import { requireBearerAuth, type OAuthTokenVerifier } from '@modelcontextprotocol/server';
import { auth0Verifier } from '@/lib/mcp/auth';
import { ACCOUNT_READ, SITE_API_AUDIENCE } from '@/lib/mcp/config';
import { verifiedEmailFor } from './auth0-mgmt';
import { getAccountSummary, type AccountSummary } from './summary';

const AUDIENCE = new URL(SITE_API_AUDIENCE);

let cached: { domain: string; verifier: OAuthTokenVerifier } | undefined;
function siteApiVerifier(): OAuthTokenVerifier | undefined {
  const domain = process.env.AUTH0_DOMAIN;
  if (!domain) return undefined;
  if (cached?.domain !== domain) {
    cached = { domain, verifier: auth0Verifier(new ApiClient({ domain, audience: AUDIENCE.href }), AUDIENCE) };
  }
  return cached.verifier;
}

export interface AccountApiDeps {
  verifier?: OAuthTokenVerifier;
  emailFor?: (sub: string) => Promise<string | undefined>;
  summary?: (email: string) => Promise<AccountSummary>;
}

/**
 * `GET /api/v1/account`: the caller's account summary. Takes only access tokens issued for the
 * site API (`aud` = SITE_API_AUDIENCE) with `account:read`; MCP tools get these by OBO exchange.
 */
export async function handleAccountRequest(request: Request, deps: AccountApiDeps = {}): Promise<Response> {
  const verifier = deps.verifier ?? siteApiVerifier();
  if (!verifier) return Response.json({ error: 'not_configured' }, { status: 503 });

  const auth = await requireBearerAuth({ verifier, requiredScopes: [ACCOUNT_READ], expectedResource: AUDIENCE })(request);
  if (auth instanceof Response) return auth;

  const sub = auth.extra?.sub;
  if (typeof sub !== 'string' || !sub) return Response.json({ error: 'invalid_token' }, { status: 401 });
  const email = await (deps.emailFor ?? verifiedEmailFor)(sub);
  if (!email) return Response.json({ error: 'email_not_verified' }, { status: 403 });

  return Response.json(await (deps.summary ?? getAccountSummary)(email), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
