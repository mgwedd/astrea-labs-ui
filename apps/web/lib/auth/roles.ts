import { isAdminUser } from '@/lib/admin/allowlist';

export type Role = 'user' | 'admin';

type SessionUser = { email?: string; email_verified?: boolean };

/**
 * Roles for a signed-in user. Every role needs a verified email, so an account whose
 * address was never confirmed has none. `admin` is the ADMIN_EMAILS allowlist.
 */
export function rolesFor(user: SessionUser | null | undefined, allowlistRaw?: string): Role[] {
  if (!user || user.email_verified !== true || !user.email) return [];
  return isAdminUser(user, allowlistRaw) ? ['user', 'admin'] : ['user'];
}

export function hasRole(user: SessionUser | null | undefined, role: Role, allowlistRaw?: string): boolean {
  return rolesFor(user, allowlistRaw).includes(role);
}
