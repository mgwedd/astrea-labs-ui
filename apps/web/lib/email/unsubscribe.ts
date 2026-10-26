import 'server-only';
import { syncContact } from './campaigns';
import { clearPreferencesByEmail } from './preferences';
import { verifyUnsubscribeToken } from './token';

export type UnsubscribeOutcome = 'done' | 'invalid' | 'expired' | 'failed';

/** Verify the token, then turn everything off in the database and in Resend. Nothing changes on a bad token. */
export async function unsubscribeWithToken(token: unknown): Promise<UnsubscribeOutcome> {
  const v = verifyUnsubscribeToken(token);
  if (!v.ok) return v.reason;
  try {
    await clearPreferencesByEmail(v.email);
  } catch (e) {
    console.error('unsubscribe: database update failed', e);
    return 'failed';
  }
  const r = await syncContact({ email: v.email, product: false, news: false, productSlugs: [] });
  if (!r.ok) console.error('unsubscribe: Resend sync failed', r.error);
  return r.ok ? 'done' : 'failed';
}
