import 'server-only';
import { forbidden, redirect } from 'next/navigation';
import { isAdminUser } from '@/lib/admin/allowlist';
import { adminLoginUrl } from '@/lib/admin/return-to';
import { auth0 } from '@/lib/auth0';

/**
 * Server-side admin gate: redirects to sign-in with no session, 403s anyone not on the allowlist.
 * Call it from every admin layout, server action and route handler; middleware is not the only line.
 */
export async function requireAdmin() {
  const session = await auth0.getSession();
  if (!session) redirect(adminLoginUrl('/admin'));
  if (!isAdminUser(session.user)) forbidden();
  return session.user;
}
