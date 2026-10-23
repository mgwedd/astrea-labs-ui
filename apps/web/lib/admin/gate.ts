import 'server-only';
import { requireRole } from '@/lib/auth/gate';

/**
 * Server-side admin gate: redirects to sign-in with no session, 403s anyone not on the allowlist.
 * Call it from every admin layout, server action and route handler; middleware is not the only line.
 */
export const requireAdmin = () => requireRole('admin', 'admin');
