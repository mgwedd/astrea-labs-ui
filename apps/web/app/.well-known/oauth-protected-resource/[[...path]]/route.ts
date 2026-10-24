import { mcpAuthConfig } from '@/lib/mcp/config';
import { protectedResourceMetadata } from '@/lib/mcp/metadata';

export const dynamic = 'force-dynamic';

/** Serves the RFC 9728 document at `/.well-known/oauth-protected-resource/mcp` and at the root fallback path. */
export async function GET(_request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const config = mcpAuthConfig();
  if (!config || !(path.length === 0 || (path.length === 1 && path[0] === 'mcp'))) {
    return new Response('Not found', { status: 404 });
  }
  return Response.json(protectedResourceMetadata(config), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' },
  });
}
