import type { ReplyOutcome } from '@/lib/feedback/replies';

const NOTICES: Record<ReplyOutcome | 'invalid', { text: string; error: boolean }> = {
  sent: { text: 'Message sent to the reporter.', error: false },
  send_failed: { text: 'The message could not be sent, so it was not recorded. Check the Resend settings.', error: true },
  no_email: { text: 'This reporter has no confirmed email on record.', error: true },
  not_found: { text: 'Submission not found.', error: true },
  invalid: { text: 'Write a message of up to 5000 characters.', error: true },
};

/** Maps the ?reply= outcome to a message. Unknown values show nothing, so no free text is reflected. */
export function replyNotice(value: string | string[] | undefined): { text: string; error: boolean } | undefined {
  return typeof value === 'string' && Object.hasOwn(NOTICES, value) ? NOTICES[value as keyof typeof NOTICES] : undefined;
}
