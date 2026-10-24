import {
  createMcpHandler,
  hostHeaderValidationResponse,
  originValidationResponse,
  type AuthInfo,
  type OAuthTokenVerifier,
} from '@modelcontextprotocol/server';
import { site } from '@/lib/site';
import { auth0Verifier, mcpApiClient, mcpBearerGate, missingTokenResponse } from './auth';
import { mcpAuthConfig } from './config';
import { authenticatedToolNames, buildMcpServer } from './server';

const LOCAL = ['localhost', '127.0.0.1', '[::1]'];

/** Hosts /mcp answers on: the apex, local dev and this deployment's own Vercel URLs (DNS rebinding guard). */
export function allowedHosts(env: NodeJS.ProcessEnv = process.env): string[] {
  const apex = new URL(site.url).hostname;
  const vercel = [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL].filter((h): h is string => !!h);
  return [apex, `www.${apex}`, ...vercel, ...LOCAL];
}

const allowedOrigins = (hosts: string[]) => hosts.flatMap((h) => [`https://${h}`, `http://${h}`]);

/** True when the JSON-RPC body (one message or a batch) calls one of `names` with `tools/call`. */
export function callsTool(body: unknown, names: Set<string>): boolean {
  return [body].flat().some((m) => {
    if (!m || typeof m !== 'object') return false;
    const { method, params } = m as { method?: unknown; params?: { name?: unknown } };
    return method === 'tools/call' && typeof params?.name === 'string' && names.has(params.name);
  });
}

export interface HandleOptions {
  /** Overrides the Auth0 verifier (tests). */
  verifier?: OAuthTokenVerifier;
}

/**
 * Serves /mcp. Public tools need no token. A request that carries a token must present a
 * valid one for this resource. An anonymous call to an authenticated tool gets the 401 challenge.
 */
export async function handleMcpRequest(request: Request, options: HandleOptions = {}): Promise<Response> {
  const hosts = allowedHosts();
  const rejected =
    hostHeaderValidationResponse(request, hosts) ?? originValidationResponse(request, allowedOrigins(hosts));
  if (rejected) return rejected;

  const config = mcpAuthConfig();
  let authInfo: AuthInfo | undefined;
  if (config) {
    if (request.headers.has('authorization')) {
      const verifier = options.verifier ?? auth0Verifier(mcpApiClient(config));
      const result = await mcpBearerGate(verifier)(request);
      if (result instanceof Response) return result;
      authInfo = result;
    } else if (request.method === 'POST') {
      const body = await request
        .clone()
        .json()
        .catch(() => undefined);
      if (callsTool(body, authenticatedToolNames())) return missingTokenResponse();
    }
  }

  const origin = new URL(request.url).origin;
  const handler = createMcpHandler(() => buildMcpServer({ origin }), { responseMode: 'json' });
  return handler.fetch(request, { authInfo });
}
