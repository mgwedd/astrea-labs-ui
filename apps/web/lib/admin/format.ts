import type { License } from '@/lib/licensing/db/schema';

/** "2026-10-24 14:05 UTC". Admin screens show UTC so reviewers agree on times. */
export function formatUtc(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export type LicenseState = 'active' | 'revoked' | 'replaced' | 'expired';

export function licenseState(l: Pick<License, 'revokedAt' | 'replacedBy' | 'expiresAt'>, now = new Date()): LicenseState {
  if (l.revokedAt) return 'revoked';
  if (l.replacedBy) return 'replaced';
  if (l.expiresAt && l.expiresAt <= now) return 'expired';
  return 'active';
}

/** Result messages for admin actions. Actions redirect with ?notice=<key>, so no free text is reflected. */
export const NOTICES = {
  approved: { text: 'Approved. License issued and key link emailed.' },
  approved_unsent: { text: 'Approved and license issued, but the key link email failed. Send it again from Licenses.', error: true },
  approve_failed: { text: 'Approval failed. Check the server log and try again.', error: true },
  declined: { text: 'Declined. A short email was sent.' },
  declined_unsent: { text: 'Declined, but the email failed.', error: true },
  not_submitted: { text: 'Only a submitted application can be approved or declined.', error: true },
  not_found: { text: 'Not found.', error: true },
  revoked: { text: 'License revoked, along with any replacements issued from it.' },
  revoke_noop: { text: 'Nothing to revoke: the license is missing or already revoked.', error: true },
  reissued: { text: 'Replacement license issued and key link emailed.' },
  reissue_failed: { text: 'Reissue failed: the key link email could not be sent, so no replacement was issued.', error: true },
  key_sent: { text: 'Key link emailed.' },
  inactive: { text: 'That license is revoked, replaced or expired.', error: true },
  issue_created: { text: 'Issue created.' },
  issue_exists: { text: 'An issue already exists for this submission.' },
  issue_failed: { text: 'Creating the GitHub issue failed. The submission is back in review.', error: true },
  in_progress: { text: 'Another approval is in progress.', error: true },
  not_reviewable: { text: 'This submission is not awaiting review.', error: true },
  rejected: { text: 'Submission rejected.' },
  test_sent: { text: 'Test email sent to you.' },
  test_failed: { text: 'The test email could not be sent. Check the Resend settings.', error: true },
  campaign_sent: { text: 'Campaign sent. Resend accepted every email.' },
  campaign_partial: { text: 'Campaign sent, but some emails failed. See the failed count below.', error: true },
  campaign_empty: { text: 'Nobody is opted in to that audience, so nothing was sent.', error: true },
  campaign_failed: { text: 'No emails were sent. Check the Resend settings and the server log.', error: true },
  test_issued: { text: 'Test license issued. Reveal it below.' },
  test_revoked: { text: 'Test license revoked. Apps drop it at their next revocation check.' },
  email_retried: { text: 'Email sent.' },
  email_retry_failed: { text: 'The email failed again. The new error is shown below.', error: true },
  email_dismissed: { text: 'Email dismissed. It will not be sent.' },
  invalid: { text: 'Some fields are missing or invalid.', error: true },
} as const satisfies Record<string, { text: string; error?: boolean }>;

export type NoticeKey = keyof typeof NOTICES;

export const isNoticeKey = (v: unknown): v is NoticeKey => typeof v === 'string' && Object.hasOwn(NOTICES, v);
