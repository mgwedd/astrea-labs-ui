'use server';

import { requireUser } from '@/lib/auth/gate';
import { savePreferences } from '@/lib/email/preferences';

export type EmailPrefsState = { ok: boolean; message: string } | null;

/** Save the signed-in user's two checkboxes. Both unticked when absent from the form. */
export async function saveEmailPreferences(_prev: EmailPrefsState, form: FormData): Promise<EmailPrefsState> {
  const user = await requireUser();
  const product = form.get('product') === 'on';
  const news = form.get('news') === 'on';
  try {
    await savePreferences({ sub: user.sub, email: user.email, product, news });
    return { ok: true, message: 'Saved.' };
  } catch (e) {
    console.error('email preferences: save failed', e);
    return { ok: false, message: 'Could not save. Try again.' };
  }
}
