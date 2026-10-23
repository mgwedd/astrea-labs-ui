import { loginUrl, safeReturnTo } from '@/lib/auth/return-to';

/** Only `/admin` paths may be a post-login target; anything else falls back to `/admin`. */
export const safeAdminReturnTo = (path: string | null | undefined) => safeReturnTo(path, 'admin');

export const adminLoginUrl = (path: string | null | undefined) => loginUrl(path, 'admin');
