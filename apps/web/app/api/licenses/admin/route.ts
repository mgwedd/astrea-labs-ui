import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { betaDeps } from '@/lib/beta-access/server';
import { approve, decline, getApplication, listApplications, resendKeyLink } from '@/lib/beta-access/service';
import { hasBearer } from '@/lib/licensing/auth';
import { licenses } from '@/lib/licensing/db/schema';
import { normalizeEmail, reissueLicense, revokeLicense } from '@/lib/licensing/service';

// Admin API, authorized with "Authorization: Bearer $LICENSE_ADMIN_TOKEN".
//   POST {"action":"list","email"}                         list licenses for an address
//   POST {"action":"revoke","lid","reason","by"}            revoke a license; "by" records who did it
//   POST {"action":"reissue","lid","revokeOld"?,"reason"?,"by"?,"expiresAt"?}  email a key link for a replacement
//        "by" is required when revokeOld is true.
//        expiresAt: ISO 8601 date-time for an expiring license, or null for one
//        that never expires. Omitted: keep the old license's policy.
//   POST {"action":"applications","status"?}               list beta applications (draft|submitted|approved|declined)
//   POST {"action":"application","id"}                     one application: answers, consents, signed document, reviews
//   POST {"action":"approve","applicationId","reviewer","licenseCheck":{source,result,checkedAt},"notes"?}
//        record the review, issue a 6-month license and email a key link
//   POST {"action":"decline","applicationId","reviewer","licenseCheck"?,"notes"?}
//        record the review and send a short neutral email
//   POST {"action":"key-link","lid"}                       email a fresh single-use key link
// Approve and decline work only on a "submitted" application (409 otherwise).

const headers = { 'Cache-Control': 'no-store' };
const unauthorized = () => Response.json({ error: 'Unauthorized' }, { status: 401, headers });

const LicenseCheck = z.object({
  source: z.enum(['board', 'nppes']),
  result: z.string().min(1).max(500),
  checkedAt: z.iso.datetime({ offset: true }),
});
const Review = {
  applicationId: z.uuid(),
  reviewer: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
};

const Revoker = z.string().min(1).max(200);

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list'), email: z.email() }),
  z.object({ action: z.literal('revoke'), lid: z.uuid(), reason: z.string().min(1).max(200), by: Revoker }),
  z.object({
    action: z.literal('reissue'),
    lid: z.uuid(),
    revokeOld: z.boolean().default(false),
    reason: z.string().max(200).optional(),
    by: Revoker.optional(),
    expiresAt: z.iso
      .datetime({ offset: true })
      .transform((s) => new Date(s))
      .refine((d) => d.getTime() > Date.now(), 'expiresAt must be in the future')
      .nullable()
      .optional(),
  }),
  z.object({ action: z.literal('applications'), status: z.enum(['draft', 'submitted', 'approved', 'declined']).optional() }),
  z.object({ action: z.literal('application'), id: z.uuid() }),
  z.object({ action: z.literal('approve'), ...Review, licenseCheck: LicenseCheck }),
  z.object({ action: z.literal('decline'), ...Review, licenseCheck: LicenseCheck.optional() }),
  z.object({ action: z.literal('key-link'), lid: z.uuid() }),
]);

export async function POST(request: Request) {
  if (!hasBearer(request, process.env.LICENSE_ADMIN_TOKEN)) return unauthorized();
  const parsed = Action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400, headers });

  try {
    return await handle(request, parsed.data);
  } catch (err) {
    // By type only: driver errors carry query params (emails, answers).
    console.error('license admin failed', err instanceof Error ? err.name : typeof err);
    return Response.json({ error: 'Internal error.' }, { status: 500, headers });
  }
}

async function handle(request: Request, input: z.infer<typeof Action>): Promise<Response> {
  const deps = betaDeps(request);
  switch (input.action) {
    case 'list': {
      const rows = await deps.db
        .select()
        .from(licenses)
        .where(eq(licenses.email, normalizeEmail(input.email)))
        .orderBy(desc(licenses.issuedAt));
      return Response.json({ licenses: rows }, { headers });
    }
    case 'applications':
      return Response.json({ applications: await listApplications(deps, input.status) }, { headers });
    case 'application': {
      const found = await getApplication(deps, input.id);
      if (!found) return Response.json({ error: 'No such application.' }, { status: 404, headers });
      return Response.json(found, { headers });
    }
    case 'approve':
    case 'decline': {
      const r = input.action === 'approve' ? await approve(deps, input) : await decline(deps, input);
      if (!r.ok) {
        return r.error === 'not_found'
          ? Response.json({ error: 'No such application.' }, { status: 404, headers })
          : Response.json({ error: 'Only a submitted application can be approved or declined.' }, { status: 409, headers });
      }
      return Response.json({ review: r.review, lid: r.lid, emailed: r.emailed }, { headers });
    }
    case 'key-link': {
      const r = await resendKeyLink(deps, input.lid);
      if (r === 'sent') return Response.json({ ok: true }, { headers });
      return Response.json(
        { error: r === 'not_found' ? 'No such license.' : 'License is revoked, replaced or expired.' },
        { status: r === 'not_found' ? 404 : 409, headers },
      );
    }
    case 'revoke':
    case 'reissue': {
      if (input.action === 'reissue' && input.revokeOld && !input.by) {
        return Response.json({ error: '"by" is required when revokeOld is true.' }, { status: 400, headers });
      }
      const row =
        input.action === 'revoke'
          ? await revokeLicense(deps, input.lid, input.reason, input.by)
          : await reissueLicense(deps, input.lid, {
              revokeOld: input.revokeOld,
              reason: input.reason,
              by: input.by,
              expiresAt: input.expiresAt,
            });
      if (!row) return Response.json({ error: 'No such license (or already revoked).' }, { status: 404, headers });
      return Response.json({ license: row }, { headers });
    }
  }
}
