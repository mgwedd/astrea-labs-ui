import { handleMcpRequest } from '@/lib/mcp/handler';

// Streamable HTTP MCP server. Stateless and JSON-only, so it fits a Vercel Function on Node.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handle = (request: Request) => handleMcpRequest(request);

export { handle as DELETE, handle as GET, handle as POST };
