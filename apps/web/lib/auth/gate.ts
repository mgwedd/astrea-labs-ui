import 'server-only';
import { forbidden, redirect } from 'next/navigation';
import { auth0 } from '@/lib/auth0';
import { hasRole, type Role } from '@/lib/auth/roles';
import { loginUrl, type AuthArea } from '@/lib/auth/return-to';

/** The signed-in user, or null. Safe to call anywhere on the server. */
export async function getUser() {
  const session = await auth0.getSession();
  return session?.user ?? null;
}

/**
 * Page and layout gate: redirects to sign-in with no session, 403s without the role.
 * `returnTo` is where sign-in lands afterwards (it must sit inside `area`).
 */
export async function requireRole(role: Role, area: AuthArea = role === 'admin' ? 'admin' : 'account', returnTo?: string) {
  const user = await getUser();
  if (!user) redirect(loginUrl(returnTo ?? `/${area}`, area));
  if (!hasRole(user, role)) forbidden();
  return user as typeof user & { email: string };
}

/** Any signed-in user with a verified email. */
export const requireUser = () => requireRole('user', 'account');
