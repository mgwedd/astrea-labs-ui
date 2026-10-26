'use server';

import { redirect } from 'next/navigation';
import { unsubscribeWithToken } from '@/lib/email/unsubscribe';

/** The confirm button on the unsubscribe page. The token travels in the form, never in the redirect. */
export async function confirmUnsubscribe(form: FormData) {
  const outcome = await unsubscribeWithToken(form.get('t'));
  redirect(`/email/unsubscribe?r=${outcome}`);
}
