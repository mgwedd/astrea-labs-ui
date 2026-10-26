import 'server-only';
import { forbidden, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/gate';
import { hasRole } from '@/lib/auth/roles';
import { loginUrl } from '@/lib/auth/return-to';
import { forumDeps } from './server';
import { hasForumLicense, type Deps, type Viewer } from './service';

type SessionUser = { sub?: string; email?: string; email_verified?: boolean };

/**
 * Can this session use the forum? True for admins, and for verified users whose email holds a
 * license that is neither revoked nor expired. Never throws for a missing session: it is for UI
 * decisions such as showing the nav link. Pages and actions must still call requireForumMember().
 */
export async function canUseForum(user: SessionUser | null | undefined, deps: Pick<Deps, 'db' | 'now'> = forumDeps()): Promise<boolean> {
  if (!user?.email || !user.sub) return false;
  if (hasRole(user, 'admin')) return true;
  if (!hasRole(user, 'user')) return false;
  return hasForumLicense(deps, user.email);
}

/**
 * Page, action and route gate for the forum. No session: redirect to sign-in, back to `returnTo`
 * (default /forum). Signed in without an approved license (or an unverified email): 403.
 * Returns the Viewer to pass to the services.
 */
export async function requireForumMember(returnTo?: string, deps?: Pick<Deps, 'db' | 'now'>): Promise<Viewer> {
  const user = (await getUser()) as SessionUser | null;
  if (!user) redirect(loginUrl(returnTo ?? '/forum', 'forum'));
  if (!(await canUseForum(user, deps))) forbidden();
  return { sub: user.sub as string, email: (user.email as string).toLowerCase(), isAdmin: hasRole(user, 'admin') };
}
