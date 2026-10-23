/** Only `/admin` paths may be a post-login target; anything else falls back to `/admin`. */
export function safeAdminReturnTo(path: string | null | undefined): string {
  if (path && /^\/admin(\/[A-Za-z0-9._~-]+)*\/?$/.test(path) && !path.split('/').includes('..')) return path;
  return '/admin';
}

export function adminLoginUrl(path: string | null | undefined): string {
  return `/auth/login?returnTo=${encodeURIComponent(safeAdminReturnTo(path))}`;
}
