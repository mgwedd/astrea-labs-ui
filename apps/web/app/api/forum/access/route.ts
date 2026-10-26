import { getUser } from '@/lib/auth/gate';
import { canUseForum } from '@/lib/forum/gate';

export const dynamic = 'force-dynamic';

/** Whether the current session may use the forum. Drives the header link; never exposes anything else. */
export async function GET() {
  const user = await getUser();
  const ok = user ? await canUseForum(user) : false;
  return Response.json({ canUse: ok }, { headers: { 'Cache-Control': 'private, no-store' } });
}
