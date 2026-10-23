/** Areas that sit behind sign-in. Only these may be a post-login target. */
export type AuthArea = 'admin' | 'account';

/** A path inside `area`, or `/<area>` for anything else (other areas, other hosts, `..`). */
export function safeReturnTo(path: string | null | undefined, area: AuthArea): string {
  const inArea = new RegExp(`^/${area}(/[A-Za-z0-9._~-]+)*/?$`);
  if (path && inArea.test(path) && !path.split('/').includes('..')) return path;
  return `/${area}`;
}

export function loginUrl(path: string | null | undefined, area: AuthArea): string {
  return `/auth/login?returnTo=${encodeURIComponent(safeReturnTo(path, area))}`;
}

/** Which gated area a pathname belongs to. `/account/join` is the public invite landing page. */
export function gatedArea(pathname: string): AuthArea | null {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/account/join' || pathname.startsWith('/account/join/')) return null;
  if (pathname === '/account' || pathname.startsWith('/account/')) return 'account';
  return null;
}
