'use server';

// Server action for messaging a feedback reporter. It calls requireAdmin() first (actions are
// reachable by POST on their own) and redirects with ?reply=<outcome>, so no free text is reflected.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/gate';
import { feedbackDbDeps } from '@/lib/feedback/server';
import { MAX_REPLY_LENGTH, replyToReporter, type ReplyOutcome } from '@/lib/feedback/replies';
import { resendMailer } from '@/lib/licensing/mailer';
import { siteUrlFor } from '@/lib/licensing/server';

const ReplyForm = z.object({
  id: z.uuid(),
  message: z.string().trim().min(1).max(MAX_REPLY_LENGTH),
});

export async function replyToReporterAction(form: FormData) {
  const admin = await requireAdmin();
  const parsed = ReplyForm.safeParse({ id: form.get('id'), message: form.get('message') });
  if (!parsed.success) {
    const id = z.uuid().safeParse(form.get('id'));
    return redirect(id.success ? `/admin/feedback/${id.data}?reply=invalid` : '/admin/feedback');
  }
  const { id, message } = parsed.data;

  let outcome: ReplyOutcome;
  try {
    outcome = await replyToReporter({ ...feedbackDbDeps(), mailer: resendMailer(), baseUrl: siteUrlFor() }, { submissionId: id, body: message, sentBy: admin.email ?? '' });
  } catch (e) {
    console.error('feedback reply failed', e instanceof Error ? e.message : 'unknown error');
    outcome = 'send_failed';
  }
  revalidatePath(`/admin/feedback/${id}`);
  redirect(`/admin/feedback/${id}?reply=${outcome}`);
}
