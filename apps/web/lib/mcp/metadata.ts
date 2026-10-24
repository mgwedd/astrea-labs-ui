import { buildOAuthProtectedResourceMetadata, type OAuthProtectedResourceMetadata } from '@modelcontextprotocol/server';
import { site } from '@/lib/site';
import { MCP_RESOURCE, MCP_SCOPES, type McpAuthConfig } from './config';

/** RFC 9728 metadata for /mcp. It names Auth0 as the authorization server; clients read Auth0's own metadata from there. */
export function protectedResourceMetadata(config: McpAuthConfig): OAuthProtectedResourceMetadata {
  const issuer = `https://${config.domain}/`;
  return buildOAuthProtectedResourceMetadata({
    oauthMetadata: {
      issuer,
      authorization_endpoint: `${issuer}authorize`,
      token_endpoint: `${issuer}oauth/token`,
      response_types_supported: ['code'],
    },
    resourceServerUrl: MCP_RESOURCE,
    scopesSupported: MCP_SCOPES,
    resourceName: `${site.name} MCP server`,
    serviceDocumentationUrl: new URL('/llms.txt', site.url),
  });
}
