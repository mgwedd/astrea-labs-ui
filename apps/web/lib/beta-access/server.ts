import 'server-only';
import { licensingDeps, siteUrlFor } from '../licensing/server';
import { defaultBlobStore } from '../agreements/signed/blob';
import { defaultSealer, type Sealer } from '../agreements/signed/seal';
import { getLegalDocs } from '../aletheia-docs';
import type { BetaDeps } from './service';

export const SESSION_COOKIE = 'beta_session';

/**
 * Production dependencies: licensing Deps plus Blob, the sealer, the site URL
 * and BETA_REVIEW_EMAIL (unset skips the review email). The sealer is
 * resolved on first use, so pages that only read the session don't need
 * SEAL_KMS_ISSUER_ID.
 */
export function betaDeps(request?: Request): BetaDeps {
  let sealer: Sealer | undefined;
  return {
    ...licensingDeps(request),
    blob: defaultBlobStore(),
    sealer: { seal: (message) => (sealer ??= defaultSealer()).seal(message) },
    siteUrl: siteUrlFor(request),
    reviewEmail: process.env.BETA_REVIEW_EMAIL?.trim() || null,
    legalDocs: getLegalDocs,
  };
}

export const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/** Set-Cookie for the beta session: HttpOnly, SameSite=Lax, Path=/ (it serves /api/beta/* and /aletheia/beta/*), Secure in production. */
export function sessionCookie(value: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}${secure}`;
}

export function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=');
  }
  return undefined;
}

/** IP from x-forwarded-for (first entry; Vercel sets it) or x-real-ip. */
export function requestMeta(request: Request): { ip: string | null; ua: string | null } {
  const xff = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = (xff || request.headers.get('x-real-ip')?.trim() || null)?.slice(0, 64) ?? null;
  const ua = request.headers.get('user-agent')?.slice(0, 512) || null;
  return { ip, ua };
}

/**
 * CSRF check for state-changing POSTs. The Origin header, when present, must
 * be this site (the canonical site URL or the request's own origin). Browsers
 * send Origin on every cross-site POST, so a missing one isn't a cross-site
 * browser request.
 */
export function sameOrigin(request: Request, siteUrl: string): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  return origin === new URL(siteUrl).origin || origin === new URL(request.url).origin;
}

/** For JSON endpoints: same origin AND content-type application/json (a form can't send that cross-site without a preflight). */
export function isSameOriginJson(request: Request, siteUrl: string): boolean {
  const type = request.headers.get('content-type') ?? '';
  return sameOrigin(request, siteUrl) && /^application\/json\b/i.test(type);
}

export const errType = (err: unknown) => (err instanceof Error ? err.name : typeof err);
