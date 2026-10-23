import { checkBotId } from 'botid/server';
import { isSameOriginJson } from '@/lib/beta-access/server';
import { siteUrlFor } from '@/lib/licensing/server';
import { feedbackDbDeps, NO_STORE } from '@/lib/feedback/server';
import { confirmFeedback } from '@/lib/feedback/service';

// POST only (the confirm page's button), so link scanners that GET the email
// link cannot trigger it. Confirming queues the submission for review.
export async function POST(request: Request) {
  if (!isSameOriginJson(request, siteUrlFor(request))) return Response.json({ status: 'blocked' }, { status: 403, headers: NO_STORE });
  const verdict = await checkBotId();
  if (verdict.isBot) return Response.json({ status: 'blocked' }, { status: 403, headers: NO_STORE });

  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token : '';
  if (token.length < 20 || token.length > 100) return Response.json({ status: 'invalid' }, { status: 400, headers: NO_STORE });

  try {
    const result = await confirmFeedback(feedbackDbDeps(), token);
    const code = result.status === 'received' || result.status === 'already' ? 200 : result.status === 'expired' ? 410 : 404;
    return Response.json(result, { status: code, headers: NO_STORE });
  } catch (err) {
    console.error('feedback confirm failed', err instanceof Error ? err.name : 'unknown error');
    return Response.json({ status: 'failed' }, { status: 502, headers: NO_STORE });
  }
}
