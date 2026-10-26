'use server';

import { requireUser } from '@/lib/auth/gate';
import { syncContact } from '@/lib/email/campaigns';
import { savePreferences } from '@/lib/email/preferences';

export type EmailPrefsState = { ok: boolean; message: string } | null;

/** Save the signed-in user's two checkboxes, then mirror them to Resend. Both unticked when absent from the form. */
export async function saveEmailPreferences(_prev: EmailPrefsState, form: FormData): Promise<EmailPrefsState> {
  const user = await requireUser();
  const product = form.get('product') === 'on';
  const news = form.get('news') === 'on';
  try {
    const saved = await savePreferences({ sub: user.sub, email: user.email, product, news });
    const r = await syncContact({ email: user.email, product, news, productSlugs: saved.productSlugs });
    if (!r.ok) {
      console.error('email preferences: Resend sync failed', r.error);
      return { ok: false, message: 'Saved, but updating the mailing list failed. Try again.' };
    }
    return { ok: true, message: 'Saved.' };
  } catch (e) {
    console.error('email preferences: save failed', e);
    return { ok: false, message: 'Could not save. Try again.' };
  }
}
