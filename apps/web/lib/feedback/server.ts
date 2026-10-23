import 'server-only';
import { getDb } from '@/lib/licensing/db/client';
import { resendMailer } from '@/lib/licensing/mailer';
import { site } from '@/lib/site';
import type { Db, DbDeps, Deps } from './service';

/** Responses carry submission state; never cache them. */
export const NO_STORE = { 'Cache-Control': 'no-store' } as const;

// The Neon client's schema only affects relational queries, which feedback does not use.
export const feedbackDbDeps = (): DbDeps => ({ db: getDb() as unknown as Db });

/** Production dependencies for submit. Reuses the licensing Neon client and Resend mailer. */
export function feedbackDeps(request: Request): Deps {
  const baseUrl = process.env.NODE_ENV === 'production' ? site.url : new URL(request.url).origin;
  return { ...feedbackDbDeps(), mailer: resendMailer(), baseUrl };
}
