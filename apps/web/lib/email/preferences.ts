import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/licensing/db/client';
import { licenses } from '@/lib/licensing/db/schema';
import { emailPreferences, type EmailPreferences } from './db/schema';

export type Prefs = { product: boolean; news: boolean };

/** No saved choice means both off. */
export const toPrefs = (row: Pick<EmailPreferences, 'productOptInAt' | 'newsOptInAt'> | null | undefined): Prefs => ({
  product: Boolean(row?.productOptInAt),
  news: Boolean(row?.newsOptInAt),
});

// The licenses table only issues Aletheia licenses today; update this if it ever covers more.
const LICENSED_PROJECT_SLUG = 'aletheia';

async function licensedSlugs(email: string): Promise<string[]> {
  const rows = await getDb()
    .select({ lid: licenses.lid })
    .from(licenses)
    .where(and(eq(licenses.email, email), isNull(licenses.revokedAt)))
    .limit(1);
  return rows.length ? [LICENSED_PROJECT_SLUG] : [];
}

export async function getPreferences(sub: string): Promise<Prefs> {
  const [row] = await getDb().select().from(emailPreferences).where(eq(emailPreferences.auth0Sub, sub)).limit(1);
  return toPrefs(row);
}

/** Save the choice. A topic keeps its original opt-in time while it stays on. */
export async function savePreferences(args: { sub: string; email: string; product: boolean; news: boolean }) {
  const db = getDb();
  const email = args.email.trim().toLowerCase();
  const [existing] = await db.select().from(emailPreferences).where(eq(emailPreferences.auth0Sub, args.sub)).limit(1);
  const now = new Date();
  const productSlugs = args.product ? await licensedSlugs(email) : [];
  const values = {
    email,
    productOptInAt: args.product ? (existing?.productOptInAt ?? now) : null,
    newsOptInAt: args.news ? (existing?.newsOptInAt ?? now) : null,
    productSlugs,
    updatedAt: now,
  };
  await db
    .insert(emailPreferences)
    .values({ auth0Sub: args.sub, ...values })
    .onConflictDoUpdate({ target: emailPreferences.auth0Sub, set: values });
  return { product: args.product, news: args.news, productSlugs };
}

/** Switch every topic off for an address (the unsubscribe link). */
export async function clearPreferencesByEmail(email: string) {
  await getDb()
    .update(emailPreferences)
    .set({ productOptInAt: null, newsOptInAt: null, productSlugs: [], updatedAt: new Date() })
    .where(eq(emailPreferences.email, email.trim().toLowerCase()));
}
