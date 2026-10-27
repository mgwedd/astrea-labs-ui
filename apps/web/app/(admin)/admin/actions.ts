'use server';

// Server actions for the admin screens. Every action calls requireAdmin() first:
// the layout gate does not protect actions, which are reachable by POST on their own.
// Each one redirects back with ?notice=<key> (see lib/admin/format.ts).

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/gate';
import { licenseState, type NoticeKey } from '@/lib/admin/format';
import { betaDeps } from '@/lib/beta-access/server';
import { approve, decline, resendKeyLink } from '@/lib/beta-access/service';
import { feedbackDbDeps } from '@/lib/feedback/server';
import { approveSubmission, rejectSubmission } from '@/lib/feedback/service';
import { getDb } from '@/lib/licensing/db/client';
import { licenses } from '@/lib/licensing/db/schema';
import { licensingDeps } from '@/lib/licensing/server';
import { getSigningKey } from '@/lib/licensing/keys';
import { reissueLicense, revokeLicense } from '@/lib/licensing/service';
import {
  createTestLicense,
  revealTestLicense,
  revokeTestLicense,
  TEST_LICENSE_DAYS,
  type TestLicenseDays,
} from '@/lib/licensing/test-license';

const back = (path: string, notice: NoticeKey): never => {
  revalidatePath('/admin', 'layout');
  const sep = path.includes('?') ? '&' : '?';
  redirect(`${path}${sep}notice=${notice}`);
};

const text = (max: number) => z.string().trim().max(max);
const fields = (form: FormData) => Object.fromEntries(form.entries());

// ---------------------------------------------------------------- applications

/** A YYYY-MM-DD date input, not in the future, stored as midnight UTC. */
const CheckedOn = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((d) => new Date(`${d}T00:00:00.000Z`))
  .refine((d) => !Number.isNaN(d.getTime()) && d.getTime() <= Date.now(), 'checked date is in the future')
  .transform((d) => d.toISOString());

const ApproveForm = z.object({
  applicationId: z.uuid(),
  source: z.enum(['board', 'nppes']),
  result: text(500).min(1),
  checkedOn: CheckedOn,
  notes: text(2000).optional(),
});

const DeclineForm = z.object({
  applicationId: z.uuid(),
  source: z.enum(['board', 'nppes']).optional(),
  result: text(500).optional(),
  checkedOn: CheckedOn.optional().or(z.literal('').transform(() => undefined)),
  notes: text(2000).optional(),
});

const appPath = (id: string) => `/admin/applications/${id}`;

export async function approveApplication(form: FormData) {
  const user = await requireAdmin();
  const parsed = ApproveForm.safeParse(fields(form));
  const id = String(form.get('applicationId') ?? '');
  if (!parsed.success) return back(z.uuid().safeParse(id).success ? appPath(id) : '/admin/applications', 'invalid');
  const { applicationId, source, result, checkedOn, notes } = parsed.data;

  const r = await approve(betaDeps(), {
    applicationId,
    reviewer: user.email,
    licenseCheck: { source, result, checkedAt: checkedOn },
    notes: notes || undefined,
  });
  if (!r.ok) return back(appPath(applicationId), r.error);
  return back(appPath(applicationId), r.emailed ? 'approved' : 'approved_unsent');
}

export async function declineApplication(form: FormData) {
  const user = await requireAdmin();
  const parsed = DeclineForm.safeParse(fields(form));
  const id = String(form.get('applicationId') ?? '');
  if (!parsed.success) return back(z.uuid().safeParse(id).success ? appPath(id) : '/admin/applications', 'invalid');
  const { applicationId, source, result, checkedOn, notes } = parsed.data;

  // A license check is optional on decline, but if one is given it must be complete.
  const anyCheck = Boolean(result || checkedOn);
  if (anyCheck && !(source && result && checkedOn)) return back(appPath(applicationId), 'invalid');

  const r = await decline(betaDeps(), {
    applicationId,
    reviewer: user.email,
    licenseCheck: anyCheck ? { source: source!, result: result!, checkedAt: checkedOn! } : undefined,
    notes: notes || undefined,
  });
  if (!r.ok) return back(appPath(applicationId), r.error);
  return back(appPath(applicationId), r.emailed ? 'declined' : 'declined_unsent');
}

// ---------------------------------------------------------------- licenses

const lookupPath = (email: string) => `/admin/licenses?q=${encodeURIComponent(email)}`;

const LicenseForm = z.object({ lid: z.uuid(), email: z.email() });

export async function revokeLicenseAction(form: FormData) {
  const user = await requireAdmin();
  const parsed = LicenseForm.extend({ reason: text(200).min(1) }).safeParse(fields(form));
  if (!parsed.success) return back('/admin/licenses', 'invalid');
  const { lid, email, reason } = parsed.data;
  const row = await revokeLicense({ db: getDb() }, lid, reason, user.email);
  return back(lookupPath(email), row ? 'revoked' : 'revoke_noop');
}

export async function reissueLicenseAction(form: FormData) {
  const user = await requireAdmin();
  const parsed = LicenseForm.extend({
    revokeOld: z.literal('on').optional(),
    reason: text(200).optional(),
  }).safeParse(fields(form));
  if (!parsed.success) return back('/admin/licenses', 'invalid');
  const { lid, email, revokeOld, reason } = parsed.data;
  // The form only shows for active licenses; check again so a stale tab can't reissue a dead one.
  const [current] = await getDb().select().from(licenses).where(eq(licenses.lid, lid)).limit(1);
  if (!current) return back(lookupPath(email), 'not_found');
  if (licenseState(current) !== 'active') return back(lookupPath(email), 'inactive');

  let row;
  try {
    row = await reissueLicense(licensingDeps(), lid, {
      revokeOld: revokeOld === 'on',
      reason: reason || undefined,
      by: user.email,
    });
  } catch (err) {
    // reissueLicense rolls back the new license when the key-link email fails, then rethrows.
    console.error('admin reissue failed', err);
    return back(lookupPath(email), 'reissue_failed');
  }
  return back(lookupPath(email), row ? 'reissued' : 'not_found');
}

export async function sendKeyLinkAction(form: FormData) {
  await requireAdmin();
  const parsed = LicenseForm.safeParse(fields(form));
  if (!parsed.success) return back('/admin/licenses', 'invalid');
  const { lid, email } = parsed.data;
  const r = await resendKeyLink(betaDeps(), lid);
  return back(lookupPath(email), r === 'sent' ? 'key_sent' : r);
}

// ---------------------------------------------------------------- test licenses

const TestLicenseForm = z.object({
  label: text(60).min(1),
  days: z.coerce
    .number()
    .refine((d): d is TestLicenseDays => (TEST_LICENSE_DAYS as readonly number[]).includes(d)),
});
const TestLid = z.object({ lid: z.string().regex(/^test-[0-9a-f-]{36}$/) });

export async function createTestLicenseAction(form: FormData) {
  const user = await requireAdmin();
  const parsed = TestLicenseForm.safeParse(fields(form));
  if (!parsed.success) return back('/admin/licenses', 'invalid');
  await createTestLicense(
    { db: getDb(), key: getSigningKey() },
    { days: parsed.data.days as TestLicenseDays, label: parsed.data.label, by: user.email },
  );
  return back('/admin/licenses', 'test_issued');
}

/** Returns the key itself to the page; it is never put in a URL. */
export async function revealTestLicenseAction(form: FormData): Promise<{ token: string } | null> {
  await requireAdmin();
  const parsed = TestLid.safeParse(fields(form));
  if (!parsed.success) return null;
  const token = await revealTestLicense({ db: getDb(), key: getSigningKey() }, parsed.data.lid);
  return token ? { token } : null;
}

export async function revokeTestLicenseAction(form: FormData) {
  await requireAdmin();
  const parsed = TestLid.safeParse(fields(form));
  if (!parsed.success) return back('/admin/licenses', 'invalid');
  const ok = await revokeTestLicense({ db: getDb() }, parsed.data.lid);
  return back('/admin/licenses', ok ? 'test_revoked' : 'revoke_noop');
}

// ---------------------------------------------------------------- feedback

const feedbackPath = (id: string) => `/admin/feedback/${id}`;

const ApproveFeedbackForm = z.object({
  id: z.uuid(),
  title: text(256).min(1),
  body: text(60_000).min(1),
  labels: text(600)
    .optional()
    .transform((s) => (s ? s.split(',').map((l) => l.trim()).filter(Boolean) : []))
    .pipe(z.array(z.string().max(50)).max(10)),
});

export async function approveFeedbackAction(form: FormData) {
  await requireAdmin();
  const parsed = ApproveFeedbackForm.safeParse(fields(form));
  const id = String(form.get('id') ?? '');
  if (!parsed.success) return back(z.uuid().safeParse(id).success ? feedbackPath(id) : '/admin/feedback', 'invalid');
  const { id: sid, title, body, labels } = parsed.data;
  const r = await approveSubmission(feedbackDbDeps(), sid, { title, body, labels });
  const notice: NoticeKey =
    r.status === 'approved' ? 'issue_created' : r.status === 'already' ? 'issue_exists' : r.status === 'failed' ? 'issue_failed' : r.status;
  return back(feedbackPath(sid), notice);
}

export async function rejectFeedbackAction(form: FormData) {
  await requireAdmin();
  const parsed = z.object({ id: z.uuid(), note: text(500).optional() }).safeParse(fields(form));
  const id = String(form.get('id') ?? '');
  if (!parsed.success) return back(z.uuid().safeParse(id).success ? feedbackPath(id) : '/admin/feedback', 'invalid');
  const r = await rejectSubmission(feedbackDbDeps(), parsed.data.id, parsed.data.note || undefined);
  return back(feedbackPath(parsed.data.id), r.status);
}
