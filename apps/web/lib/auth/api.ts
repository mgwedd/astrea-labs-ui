import 'server-only';
import { auth0 } from '@/lib/auth0';
import { hasRole, type Role } from '@/lib/auth/roles';

/**
 * Route handler gate: the user, or a 401 (no session) / 403 (missing role) Response to return as is.
 * Middleware does not cover /api, so every handler that needs a role must call this.
 */
export async function requireRoleApi(role: Role) {
  const session = await auth0.getSession();
  if (!session) return { response: Response.json({ error: 'unauthorized' }, { status: 401 }) };
  if (!hasRole(session.user, role)) return { response: Response.json({ error: 'forbidden' }, { status: 403 }) };
  return { user: session.user as typeof session.user & { email: string } };
}
