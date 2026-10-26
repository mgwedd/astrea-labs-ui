import type { McpServer } from '@modelcontextprotocol/server';

export interface McpToolDeps {
  /** Origin of the incoming request. Tools that call the site API call it here, never a hardcoded host. */
  origin: string;
}

/**
 * One tool. To add a tool, write one of these and list it in `lib/mcp/server.ts`.
 * `scopes` marks a tool that needs a signed-in user: /mcp answers an anonymous call to it with 401.
 */
export interface McpTool {
  name: string;
  scopes?: readonly [string, ...string[]];
  register: (server: McpServer, deps: McpToolDeps) => void;
}
