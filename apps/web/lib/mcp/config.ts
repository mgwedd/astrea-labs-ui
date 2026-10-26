import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/server';
import { site } from '@/lib/site';

/** The MCP server's public URL. It is also the Auth0 API identifier, so tokens for it carry it as `aud`. */
export const MCP_RESOURCE = new URL('/mcp', site.url);

/** The site API that MCP tools call on a user's behalf. Its tokens come only from OBO token exchange. */
export const SITE_API_AUDIENCE = `${site.url}/api`;

export const ACCOUNT_READ = 'account:read';

/** Every scope a tool on this server can ask for. Advertised as `scopes_supported`. */
export const MCP_SCOPES = [ACCOUNT_READ];

export const resourceMetadataUrl = () => getOAuthProtectedResourceMetadataUrl(MCP_RESOURCE);

export interface McpAuthConfig {
  /** Auth0 tenant domain, e.g. `example.us.auth0.com`. */
  domain: string;
  /** The Custom API client linked to the MCP API. It performs the OBO exchange. */
  clientId: string;
  clientSecret: string;
}

/**
 * Auth config, or undefined when it isn't set. Without it the public tools still work,
 * the authenticated tools aren't registered and no protected resource metadata is served.
 */
export function mcpAuthConfig(env: Partial<Record<string, string>> = process.env): McpAuthConfig | undefined {
  const { AUTH0_DOMAIN: domain, MCP_OBO_CLIENT_ID: clientId, MCP_OBO_CLIENT_SECRET: clientSecret } = env;
  return domain && clientId && clientSecret ? { domain, clientId, clientSecret } : undefined;
}
