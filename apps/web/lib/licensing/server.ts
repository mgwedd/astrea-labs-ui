import 'server-only';
import { projects } from '@astrea/research-registry';
import { getDb } from './db/client';
import { getSigningKey } from './keys';
import { resendMailer } from './mailer';
import type { Deps } from './service';

const aletheia = projects.find((p) => p.slug === 'aletheia');
export const ALETHEIA_DOWNLOAD_URL = aletheia?.downloads?.[0]?.url ?? 'https://github.com/mgwedd/aletheia/releases/latest';

/**
 * The origin used in emailed links and for same-origin checks, no trailing slash.
 *   - Production (VERCEL_ENV=production): https://$VERCEL_PROJECT_PRODUCTION_URL,
 *     whatever host the request came in on, so links always use the canonical domain.
 *   - Otherwise: the request's own origin when there is a request (preview branch
 *     URLs and localhost keep working; Vercel only routes hosts assigned to the
 *     deployment, so the Host header can't be pointed elsewhere), else
 *     https://$VERCEL_URL, else http://localhost:3000.
 */
export function siteUrlFor(request?: Request): string {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV === 'production' && prod) return `https://${prod}`;
  if (request) return new URL(request.url).origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/** Production dependencies for the licensing service. */
export function licensingDeps(request?: Request): Deps {
  return {
    db: getDb(),
    key: getSigningKey(),
    mailer: resendMailer(),
    downloadUrl: ALETHEIA_DOWNLOAD_URL,
    siteUrl: siteUrlFor(request),
  };
}
