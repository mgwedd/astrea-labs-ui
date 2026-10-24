// @vitest-environment node
import { VerifyAccessTokenError, type VerifiedAccessTokenClaims } from '@auth0/auth0-api-js';
import { OAuthError, type AuthInfo, type OAuthTokenVerifier } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleAccountRequest } from '@/lib/accounts/api';
import { MemoryTokenStore, auth0Verifier, mcpBearerGate, scopesOf, siteApiToken, toAuthInfo } from '@/lib/mcp/auth';
import { MCP_RESOURCE, SITE_API_AUDIENCE, mcpAuthConfig } from '@/lib/mcp/config';
import { protectedResourceMetadata } from '@/lib/mcp/metadata';
import { GET as prmRoute } from '@/app/.well-known/oauth-protected-resource/[[...path]]/route';

const now = Math.floor(Date.now() / 1000);
const claims = (over: Partial<VerifiedAccessTokenClaims> = {}) =>
  ({ iss: 'https://tenant.example/', sub: 'email|abc', aud: MCP_RESOURCE.href, exp: now + 600, iat: now, scope: 'account:read', azp: 'client-1', ...over }) as VerifiedAccessTokenClaims;

const verifierFor = (c: VerifiedAccessTokenClaims, audience = MCP_RESOURCE): OAuthTokenVerifier =>
  auth0Verifier({ verifyAccessToken: async () => c }, audience);

const bearer = (url: string, token = 'tok') => new Request(url, { headers: { authorization: `Bearer ${token}` } });

const AUTH_ENV = { AUTH0_DOMAIN: 'tenant.example', MCP_OBO_CLIENT_ID: 'id', MCP_OBO_CLIENT_SECRET: 'secret' };

afterEach(() => vi.unstubAllEnvs());

describe('mcp auth config', () => {
  it('needs all three values', () => {
    expect(mcpAuthConfig({})).toBeUndefined();
    expect(mcpAuthConfig({ AUTH0_DOMAIN: 'tenant.example', MCP_OBO_CLIENT_ID: 'id' })).toBeUndefined();
    expect(mcpAuthConfig(AUTH_ENV)).toEqual({ domain: 'tenant.example', clientId: 'id', clientSecret: 'secret' });
  });
});

describe('token verification', () => {
  it('maps claims to AuthInfo', () => {
    const info = toAuthInfo('tok', claims({ scope: 'account:read other' }));
    expect(info).toMatchObject({ token: 'tok', clientId: 'client-1', scopes: ['account:read', 'other'], expiresAt: now + 600 });
    expect(info.resource?.href).toBe(MCP_RESOURCE.href);
    expect(info.extra?.sub).toBe('email|abc');
    expect(scopesOf(claims({ scope: undefined }))).toEqual([]);
  });

  it('leaves resource unset for a token issued to another audience', () => {
    expect(toAuthInfo('tok', claims({ aud: SITE_API_AUDIENCE })).resource).toBeUndefined();
    expect(toAuthInfo('tok', claims({ aud: ['x', MCP_RESOURCE.href] })).resource?.href).toBe(MCP_RESOURCE.href);
  });

  it('turns an SDK verification failure into invalid_token', async () => {
    const verifier = auth0Verifier({
      verifyAccessToken: async () => {
        throw new VerifyAccessTokenError('bad signature');
      },
    });
    await expect(verifier.verifyAccessToken('tok')).rejects.toBeInstanceOf(OAuthError);
  });

  it('gate: 401 with resource_metadata for a bad token, AuthInfo for a good one', async () => {
    const bad = auth0Verifier({
      verifyAccessToken: async () => {
        throw new VerifyAccessTokenError('expired');
      },
    });
    const res = await mcpBearerGate(bad)(bearer('http://localhost/mcp'));
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
    expect((res as Response).headers.get('www-authenticate')).toContain(
      'resource_metadata="https://astrealabs.com/.well-known/oauth-protected-resource/mcp"',
    );

    const ok = await mcpBearerGate(verifierFor(claims()))(bearer('http://localhost/mcp'));
    expect(ok).not.toBeInstanceOf(Response);
    expect((ok as AuthInfo).token).toBe('tok');
  });

  it('gate: rejects a token for the site API at /mcp', async () => {
    const res = await mcpBearerGate(verifierFor(claims({ aud: SITE_API_AUDIENCE })))(bearer('http://localhost/mcp'));
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
  });
});

describe('on-behalf-of exchange', () => {
  it('asks for a site API token with the verified claims and a cache', async () => {
    const getTokenOnBehalfOf = vi.fn(async () => ({ accessToken: 'api-token', expiresAt: now + 600, grantedScopes: ['account:read'] }));
    const c = claims();
    const store = new MemoryTokenStore();
    const token = await siteApiToken({ getTokenOnBehalfOf } as never, toAuthInfo('mcp-token', c), 'account:read', store);
    expect(token).toBe('api-token');
    expect(getTokenOnBehalfOf).toHaveBeenCalledWith(
      'mcp-token',
      { audience: SITE_API_AUDIENCE, scope: 'account:read' },
      { store, verified: { accessToken: 'mcp-token', claims: c } },
    );
  });

  it('token store evicts the oldest entry at capacity', async () => {
    const store = new MemoryTokenStore(2);
    const entry = { accessToken: 'a', expiresAt: now + 60 } as never;
    await store.set('1', entry);
    await store.set('2', entry);
    await store.set('3', entry);
    expect(await store.get('1')).toBeUndefined();
    expect(await store.get('3')).toBe(entry);
    await store.delete('3');
    expect(await store.get('3')).toBeUndefined();
  });
});

describe('protected resource metadata', () => {
  it('names /mcp, Auth0 and the scopes', () => {
    const prm = protectedResourceMetadata({ domain: 'tenant.example', clientId: 'id', clientSecret: 's' });
    expect(prm.resource).toBe(MCP_RESOURCE.href);
    expect(prm.authorization_servers).toEqual(['https://tenant.example/']);
    expect(prm.scopes_supported).toEqual(['account:read']);
  });

  it('route: 404 without config, JSON at /mcp and the root with config', async () => {
    const call = (path: string[]) => prmRoute(new Request('http://localhost/x'), { params: Promise.resolve({ path }) });
    expect((await call(['mcp'])).status).toBe(404);
    vi.stubEnv('AUTH0_DOMAIN', AUTH_ENV.AUTH0_DOMAIN);
    vi.stubEnv('MCP_OBO_CLIENT_ID', AUTH_ENV.MCP_OBO_CLIENT_ID);
    vi.stubEnv('MCP_OBO_CLIENT_SECRET', AUTH_ENV.MCP_OBO_CLIENT_SECRET);
    const res = await call(['mcp']);
    expect(res.status).toBe(200);
    expect((await res.json()).resource).toBe(MCP_RESOURCE.href);
    expect((await call([])).status).toBe(200);
    expect((await call(['other'])).status).toBe(404);
  });
});

describe('/api/v1/account', () => {
  const API = new URL(SITE_API_AUDIENCE);
  const summary = vi.fn(async (email: string) => ({ email, licenses: [], betaApplications: [] }));
  const url = 'http://localhost/api/v1/account';

  it('503 when Auth0 is not configured', async () => {
    vi.stubEnv('AUTH0_DOMAIN', '');
    expect((await handleAccountRequest(new Request(url))).status).toBe(503);
  });

  it('401 without a token', async () => {
    const res = await handleAccountRequest(new Request(url), { verifier: verifierFor(claims({ aud: API.href }), API), summary });
    expect(res.status).toBe(401);
  });

  it('401 for an MCP token (wrong audience)', async () => {
    const res = await handleAccountRequest(bearer(url), { verifier: verifierFor(claims(), API), summary });
    expect(res.status).toBe(401);
  });

  it('403 without account:read', async () => {
    const res = await handleAccountRequest(bearer(url), { verifier: verifierFor(claims({ aud: API.href, scope: '' }), API), summary });
    expect(res.status).toBe(403);
  });

  it('403 when the email is not verified', async () => {
    const res = await handleAccountRequest(bearer(url), {
      verifier: verifierFor(claims({ aud: API.href }), API),
      emailFor: async () => undefined,
      summary,
    });
    expect(res.status).toBe(403);
  });

  it('returns the summary for the verified email', async () => {
    const emailFor = vi.fn(async () => 'me@example.com');
    const res = await handleAccountRequest(bearer(url), { verifier: verifierFor(claims({ aud: API.href }), API), emailFor, summary });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ email: 'me@example.com', licenses: [], betaApplications: [] });
    expect(emailFor).toHaveBeenCalledWith('email|abc');
  });
});
