// @vitest-environment node
import { ApiClient, type VerifiedAccessTokenClaims } from '@auth0/auth0-api-js';
import { Client, StreamableHTTPClientTransport, type VersionNegotiationMode } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projects } from '@astrea/research-registry';
import { auth0Verifier } from '@/lib/mcp/auth';
import { MCP_RESOURCE } from '@/lib/mcp/config';
import { allowedHosts, callsTool, handleMcpRequest, type HandleOptions } from '@/lib/mcp/handler';
import { normalizePagePath } from '@/lib/mcp/tools/content';
import { getPosts } from '@/lib/writing';

const URL_MCP = 'http://localhost/mcp';
const PUBLIC_TOOLS = ['list_projects', 'get_project', 'list_posts', 'get_page'];

function enableAuth() {
  vi.stubEnv('AUTH0_DOMAIN', 'tenant.example');
  vi.stubEnv('MCP_OBO_CLIENT_ID', 'id');
  vi.stubEnv('MCP_OBO_CLIENT_SECRET', 'secret');
}

/** Next passes the Host header through; a bare test Request has none. */
function withHost(request: Request) {
  request.headers.set('host', new URL(request.url).host);
  return request;
}

async function connect(mode: VersionNegotiationMode, options: HandleOptions = {}, headers: Record<string, string> = {}) {
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    const request = withHost(new Request(input, init));
    for (const [k, v] of Object.entries(headers)) request.headers.set(k, v);
    return handleMcpRequest(request, options);
  };
  const client = new Client({ name: 'test', version: '1.0.0' }, { versionNegotiation: { mode } });
  await client.connect(new StreamableHTTPClientTransport(new URL(URL_MCP), { fetch }));
  return client;
}

const text = (result: { content?: unknown }) => (result.content as { type: string; text: string }[])[0]!.text;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('helpers', () => {
  it('normalizes page paths', () => {
    expect(normalizePagePath('https://astrealabs.com/writing/x.md')).toBe('/writing/x');
    expect(normalizePagePath('writing/x')).toBe('/writing/x');
    expect(normalizePagePath('/index.md')).toBe('/');
    expect(normalizePagePath('/research/?a=1#b')).toBe('/research');
    expect(normalizePagePath('/')).toBe('/');
  });

  it('detects authenticated tool calls, batches included', () => {
    const names = new Set(['get_my_account']);
    expect(callsTool({ method: 'tools/call', params: { name: 'get_my_account' } }, names)).toBe(true);
    expect(callsTool([{ method: 'ping' }, { method: 'tools/call', params: { name: 'get_my_account' } }], names)).toBe(true);
    expect(callsTool({ method: 'tools/call', params: { name: 'list_projects' } }, names)).toBe(false);
    expect(callsTool(undefined, names)).toBe(false);
  });

  it('allows the apex, local hosts and this deployment', () => {
    expect(allowedHosts({ VERCEL_URL: 'x.vercel.app' })).toEqual(
      expect.arrayContaining(['astrealabs.com', 'www.astrealabs.com', 'localhost', 'x.vercel.app']),
    );
  });
});

describe.each([
  ['2025 (initialize)', 'legacy' as const, /^2025-/],
  ['negotiated (server/discover)', 'auto' as const, /^2026-/],
])('MCP over Streamable HTTP, %s', (_label, mode, version) => {
  it('connects, lists the public tools and calls them', async () => {
    const client = await connect(mode);
    expect(client.getNegotiatedProtocolVersion()).toMatch(version);
    expect(client.getServerVersion()?.name).toBe('astrea-labs');

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(PUBLIC_TOOLS);
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);

    const listed = JSON.parse(text(await client.callTool({ name: 'list_projects', arguments: {} })));
    expect(listed.map((p: { slug: string }) => p.slug).sort()).toEqual(projects.map((p) => p.slug).sort());

    const slug = projects[0]!.slug;
    const project = await client.callTool({ name: 'get_project', arguments: { slug } });
    expect(project.isError).toBeFalsy();
    expect(text(project)).toContain(projects[0]!.name);

    const missing = await client.callTool({ name: 'get_project', arguments: { slug: 'nope' } });
    expect(missing.isError).toBe(true);
    expect(text(missing)).toContain(slug);

    const posts = JSON.parse(text(await client.callTool({ name: 'list_posts', arguments: {} })));
    expect(posts.length).toBe(getPosts().length);

    const home = await client.callTool({ name: 'get_page', arguments: { path: '/' } });
    expect(home.isError).toBeFalsy();
    expect(text(home).length).toBeGreaterThan(0);
    expect((await client.callTool({ name: 'get_page', arguments: { path: '/nope' } })).isError).toBe(true);

    await client.close();
  });
});

describe('auth on /mcp', () => {
  it('lists get_my_account only when auth is configured', async () => {
    enableAuth();
    const client = await connect('legacy');
    expect((await client.listTools()).tools.map((t) => t.name)).toEqual([...PUBLIC_TOOLS, 'get_my_account']);
    await client.close();
  });

  it('answers an anonymous get_my_account call with the 401 challenge', async () => {
    enableAuth();
    const res = await handleMcpRequest(
      withHost(new Request(URL_MCP, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_my_account', arguments: {} } }),
      })),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata=');
  });

  it('rejects a bad token even for public tools', async () => {
    enableAuth();
    const verifier = auth0Verifier({
      verifyAccessToken: async () => {
        throw new (await import('@auth0/auth0-api-js')).VerifyAccessTokenError('bad');
      },
    });
    const res = await handleMcpRequest(
      withHost(new Request(URL_MCP, { method: 'POST', headers: { authorization: 'Bearer bad', 'content-type': 'application/json' }, body: '{}' })),
      { verifier },
    );
    expect(res.status).toBe(401);
  });

  it('rejects a foreign Host header', async () => {
    const res = await handleMcpRequest(withHost(new Request('http://evil.example/mcp', { method: 'POST', body: '{}' })));
    expect(res.status).toBe(403);
  });

  it('calls the site API with an OBO token, never the MCP token', async () => {
    enableAuth();
    const now = Math.floor(Date.now() / 1000);
    const claims = { iss: 'https://tenant.example/', sub: 'email|abc', aud: MCP_RESOURCE.href, exp: now + 600, iat: now, scope: 'account:read' } as VerifiedAccessTokenClaims;
    const obo = vi
      .spyOn(ApiClient.prototype, 'getTokenOnBehalfOf')
      .mockResolvedValue({ accessToken: 'api-token', expiresAt: now + 600 } as never);
    const apiFetch = vi.fn(async (_url: URL, init?: RequestInit) =>
      Response.json({ email: 'me@example.com', licenses: [], betaApplications: [], auth: new Headers(init?.headers).get('authorization') }),
    );
    vi.stubGlobal('fetch', apiFetch);

    const client = await connect('legacy', { verifier: auth0Verifier({ verifyAccessToken: async () => claims }) }, { authorization: 'Bearer mcp-token' });
    const result = await client.callTool({ name: 'get_my_account', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(text(result)).auth).toBe('Bearer api-token');
    expect(obo).toHaveBeenCalledWith('mcp-token', expect.objectContaining({ scope: 'account:read' }), expect.anything());
    expect(String(apiFetch.mock.calls[0]![0])).toBe('http://localhost/api/v1/account');
    await client.close();
  });
});
