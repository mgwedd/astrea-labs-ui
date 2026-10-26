import 'server-only';
import { clearPreferencesByEmail } from './preferences';
import { verifyUnsubscribeToken } from './token';

export type UnsubscribeOutcome = 'done' | 'invalid' | 'expired' | 'failed';

/** Verify the token, then turn everything off in the database. Nothing changes on a bad token. */
export async function unsubscribeWithToken(token: unknown): Promise<UnsubscribeOutcome> {
  const v = verifyUnsubscribeToken(token);
  if (!v.ok) return v.reason;
  try {
    await clearPreferencesByEmail(v.email);
    return 'done';
  } catch (e) {
    console.error('unsubscribe: database update failed', e);
    return 'failed';
  }
}
