import {
  ApiClient,
  VerifyAccessTokenError,
  type CachedToken,
  type TokenStore,
  type VerifiedAccessTokenClaims,
} from '@auth0/auth0-api-js';
import {
  OAuthError,
  OAuthErrorCode,
  bearerAuthChallengeResponse,
  requireBearerAuth,
  type AuthInfo,
  type OAuthTokenVerifier,
} from '@modelcontextprotocol/server';
import { MCP_RESOURCE, SITE_API_AUDIENCE, resourceMetadataUrl, type McpAuthConfig } from './config';

/** OAuth `scope` claim as a list. */
export const scopesOf = (claims: VerifiedAccessTokenClaims): string[] =>
  typeof claims.scope === 'string' ? claims.scope.split(' ').filter(Boolean) : [];

/** Turns a verified Auth0 access token into the SDK's `AuthInfo`. */
export function toAuthInfo(token: string, claims: VerifiedAccessTokenClaims, audience: URL = MCP_RESOURCE): AuthInfo {
  const aud = [claims.aud ?? []].flat();
  return {
    token,
    clientId: String(claims.azp ?? claims.client_id ?? claims.sub ?? ''),
    scopes: scopesOf(claims),
    expiresAt: claims.exp,
    // Report the expected audience only. requireBearerAuth compares it with `expectedResource`.
    resource: aud.includes(audience.href) ? audience : undefined,
    extra: { sub: claims.sub, claims },
  };
}

/** Verifies tokens with Auth0's JWKS (signature, issuer, expiry, audience) through the official SDK. */
export function auth0Verifier(api: Pick<ApiClient, 'verifyAccessToken'>, audience: URL = MCP_RESOURCE): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token) {
      try {
        return toAuthInfo(token, await api.verifyAccessToken({ accessToken: token }), audience);
      } catch (error) {
        if (error instanceof VerifyAccessTokenError) throw new OAuthError(OAuthErrorCode.InvalidToken, error.message);
        throw error;
      }
    },
  };
}

/** One ApiClient per config: it caches JWKS and discovery between requests on a warm instance. */
let cached: { config: McpAuthConfig; api: ApiClient } | undefined;
export function mcpApiClient(config: McpAuthConfig): ApiClient {
  if (cached?.config !== config) {
    cached = {
      config,
      api: new ApiClient({
        domain: config.domain,
        audience: MCP_RESOURCE.href,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      }),
    };
  }
  return cached.api;
}

/** The bearer gate for /mcp: 401 with `WWW-Authenticate … resource_metadata` for a bad token. */
export const mcpBearerGate = (verifier: OAuthTokenVerifier) =>
  requireBearerAuth({ verifier, resourceMetadataUrl: resourceMetadataUrl(), expectedResource: MCP_RESOURCE });

/** The 401 an anonymous call to an authenticated tool gets, so the client starts its OAuth flow. */
export const missingTokenResponse = () =>
  bearerAuthChallengeResponse(new OAuthError(OAuthErrorCode.InvalidToken, 'This tool needs you to sign in.'), {
    resourceMetadataUrl: resourceMetadataUrl(),
  });

/** In-memory OBO cache for a warm function instance. Auth0 rate-limits token exchange, so reuse tokens until they expire. */
export class MemoryTokenStore implements TokenStore {
  #entries = new Map<string, CachedToken>();
  constructor(private readonly max = 500) {}
  async get(key: string) {
    return this.#entries.get(key);
  }
  async set(key: string, value: CachedToken) {
    if (this.#entries.size >= this.max) this.#entries.delete(this.#entries.keys().next().value!);
    this.#entries.set(key, value);
  }
  async delete(key: string) {
    this.#entries.delete(key);
  }
}

const oboStore = new MemoryTokenStore();

/**
 * Exchanges the caller's MCP token for a site API token (RFC 8693, Auth0 On-Behalf-Of).
 * The MCP token itself never leaves this server.
 */
export async function siteApiToken(
  api: Pick<ApiClient, 'getTokenOnBehalfOf'>,
  authInfo: AuthInfo,
  scope: string,
  store: TokenStore = oboStore,
): Promise<string> {
  const claims = authInfo.extra?.claims as VerifiedAccessTokenClaims | undefined;
  const result = await api.getTokenOnBehalfOf(
    authInfo.token,
    { audience: SITE_API_AUDIENCE, scope },
    { store, verified: claims ? { accessToken: authInfo.token, claims } : undefined },
  );
  return result.accessToken;
}
