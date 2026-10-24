import { requireScopes } from '@modelcontextprotocol/server';
import { mcpApiClient, siteApiToken } from '../auth';
import { ACCOUNT_READ, mcpAuthConfig } from '../config';
import type { McpTool } from './types';

/**
 * The signed-in user's licenses and beta applications. Calls `/api/v1/account` with a token
 * from OBO token exchange, so the API sees a token issued for it, never the MCP token.
 */
export const getMyAccount: McpTool = {
  name: 'get_my_account',
  scopes: [ACCOUNT_READ],
  register: (server, { origin }) =>
    server.registerTool(
      'get_my_account',
      {
        title: 'Get my account',
        description:
          'Your Astrea Labs licenses (tier, status, dates) and beta applications (status, date). Needs sign-in. Never returns license keys.',
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        scopeChallenge: requireScopes(ACCOUNT_READ),
      },
      async (ctx) => {
        const authInfo = ctx.http?.authInfo;
        const config = mcpAuthConfig();
        // /mcp answers anonymous calls with 401 before this runs; this is a second check.
        if (!authInfo || !config) return { content: [{ type: 'text', text: 'Sign in to use this tool.' }], isError: true };
        const token = await siteApiToken(mcpApiClient(config), authInfo, ACCOUNT_READ);
        const res = await fetch(new URL('/api/v1/account', origin), { headers: { authorization: `Bearer ${token}` } });
        if (!res.ok) return { content: [{ type: 'text', text: `The account API answered ${res.status}.` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(await res.json(), null, 2) }] };
      },
    ),
};
