import { z } from 'zod';
import { hasBearer } from '@/lib/licensing/auth';
import { FEEDBACK_STATUSES } from '@/lib/feedback/db/schema';
import { feedbackDbDeps, NO_STORE } from '@/lib/feedback/server';
import { approveSubmission, getSubmission, listSubmissions, rejectSubmission } from '@/lib/feedback/service';

// Triage API, authorized with "Authorization: Bearer $LICENSE_ADMIN_TOKEN" (shared with licensing for now).
//   POST {"action":"list","status"?}                          submissions, newest first (includes private email)
//   POST {"action":"get","id"}                                one submission plus the issue draft it would create
//   POST {"action":"approve","id","title"?,"body"?,"labels"?} create the public issue (once); edits replace the draft
//   POST {"action":"reject","id","note"?}                     close without posting
// Edited title/body/labels are posted as given: neutralise @mentions yourself.

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list'), status: z.enum(FEEDBACK_STATUSES).optional() }),
  z.object({ action: z.literal('get'), id: z.uuid() }),
  z.object({
    action: z.literal('approve'),
    id: z.uuid(),
    title: z.string().min(1).max(256).optional(),
    body: z.string().min(1).max(60_000).optional(),
    labels: z.array(z.string().min(1).max(50)).max(10).optional(),
  }),
  z.object({ action: z.literal('reject'), id: z.uuid(), note: z.string().max(500).optional() }),
]);

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: NO_STORE });

export async function POST(request: Request) {
  if (!hasBearer(request, process.env.LICENSE_ADMIN_TOKEN)) return json({ error: 'Unauthorized' }, 401);
  const parsed = Action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: z.prettifyError(parsed.error) }, 400);

  const deps = feedbackDbDeps();
  const input = parsed.data;
  switch (input.action) {
    case 'list':
      return json({ submissions: await listSubmissions(deps, input.status) });
    case 'get': {
      const submission = await getSubmission(deps, input.id);
      return submission ? json({ submission }) : json({ error: 'Not found' }, 404);
    }
    case 'approve': {
      const { action: _a, id, ...edits } = input;
      const result = await approveSubmission(deps, id, edits);
      const code = result.status === 'approved' || result.status === 'already' ? 200 : result.status === 'not_found' ? 404 : result.status === 'failed' ? 502 : 409;
      return json(result, code);
    }
    case 'reject': {
      const result = await rejectSubmission(deps, input.id, input.note);
      return json(result, result.status === 'rejected' ? 200 : result.status === 'not_found' ? 404 : 409);
    }
  }
}
