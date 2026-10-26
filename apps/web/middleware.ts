import { NextRequest, NextResponse } from 'next/server';
import { PROJECT_SUBDOMAINS } from '@astrea/research-registry';
import { gatedArea, loginUrl } from '@/lib/auth/return-to';
import { auth0 } from '@/lib/auth0';

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // Skip static assets, Next.js internals, and favicon
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for explicit query override in dev/preview: e.g. ?subdomain=sda
  const querySubdomain = url.searchParams.get('subdomain')?.toLowerCase();
  
  // Extract subdomain from hostname
  // Handles: sda.astrealabs.com, aletheia.localhost:3000, etc.
  let hostSubdomain = '';
  
  // Strip port from hostname if present
  const hostWithoutPort = hostname.split(':')[0] || '';
  const hostParts = hostWithoutPort.split('.');

  // If localhost with subdomain (e.g., sda.localhost)
  if (hostWithoutPort.endsWith('localhost') && hostParts.length > 1) {
    hostSubdomain = hostParts[0];
  } else if (
    hostWithoutPort.endsWith('astrealabs.com') &&
    hostParts.length > 2 &&
    hostParts[0] !== 'www'
  ) {
    hostSubdomain = hostParts[0];
  }

  const activeSubdomain = querySubdomain || hostSubdomain;

  // On a real project subdomain, everything but the landing page lives on the apex.
  if (hostSubdomain && hostWithoutPort.endsWith('astrealabs.com') && url.pathname !== '/') {
    return NextResponse.redirect(new URL(`${url.pathname}${url.search}`, 'https://astrealabs.com'));
  }

  // Auth0 sign-in routes (/auth/*) and the signed-in areas (session rolling) live on the apex only.
  const isAuthRoute = url.pathname.startsWith('/auth/');
  const gated = gatedArea(url.pathname);
  if (!hostSubdomain && (isAuthRoute || gated)) {
    const authResponse = await auth0.middleware(request);
    // Signed out on a gated page: sign in, then come back to this exact page.
    if (gated && !(await auth0.getSession(request))) {
      return NextResponse.redirect(new URL(loginUrl(url.pathname, gated), request.url));
    }
    authResponse.headers.set('x-astrea-subdomain', 'root');
    return authResponse;
  }

  // A project subdomain's root shows its landing page.
  if (activeSubdomain && PROJECT_SUBDOMAINS.includes(activeSubdomain) && url.pathname === '/') {
    const response = NextResponse.rewrite(new URL(`/subdomains/${activeSubdomain}`, request.url));
    response.headers.set('x-astrea-subdomain', activeSubdomain);
    return response;
  }

  const response = NextResponse.next();
  response.headers.set('x-astrea-subdomain', 'root');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
