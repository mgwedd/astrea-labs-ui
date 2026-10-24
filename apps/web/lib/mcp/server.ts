import { McpServer } from '@modelcontextprotocol/server';
import { site } from '@/lib/site';
import { mcpAuthConfig } from './config';
import { getMyAccount } from './tools/account';
import { contentTools } from './tools/content';
import type { McpTool, McpToolDeps } from './tools/types';

/** Public tools first. Tools with `scopes` are listed only when auth is configured. */
export const ALL_TOOLS: McpTool[] = [...contentTools, getMyAccount];

export const activeTools = (authConfigured = !!mcpAuthConfig()) =>
  ALL_TOOLS.filter((t) => !t.scopes || authConfigured);

/** Names of tools that need a signed-in caller. */
export const authenticatedToolNames = () => new Set(activeTools().filter((t) => t.scopes).map((t) => t.name));

export function buildMcpServer(deps: McpToolDeps): McpServer {
  const server = new McpServer(
    { name: 'astrea-labs', title: site.name, version: '1.0.0', websiteUrl: site.url },
    { instructions: `Read-only access to ${site.name}: projects, posts and every page as markdown.` },
  );
  for (const tool of activeTools()) tool.register(server, deps);
  return server;
}
