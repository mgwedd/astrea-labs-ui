import { checkBotId } from 'botid/server';
import { isSameOriginJson } from '@/lib/beta-access/server';
import { siteUrlFor } from '@/lib/licensing/server';
import { feedbackDeps, NO_STORE } from '@/lib/feedback/server';
import { submitFeedback } from '@/lib/feedback/service';
import { FeedbackSchema } from '@/lib/feedback/validation';

// Stores the report as unconfirmed and emails a confirm link. Nothing reaches
// GitHub from here. The reply is 202 whether or not the address is rate-limited,
// so the endpoint cannot be used to probe addresses.
export async function POST(request: Request) {
  if (!isSameOriginJson(request, siteUrlFor(request))) return Response.json({ error: 'Request blocked.' }, { status: 403, headers: NO_STORE });
  const verdict = await checkBotId();
  if (verdict.isBot) return Response.json({ error: 'Request blocked.' }, { status: 403, headers: NO_STORE });

  const parsed = FeedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? 'form')] ??= issue.message;
    return Response.json({ error: 'Please fix the highlighted fields.', fields }, { status: 400, headers: NO_STORE });
  }

  try {
    await submitFeedback(feedbackDeps(request), parsed.data);
  } catch (err) {
    // Error type only: Drizzle messages include query params (the email).
    console.error('feedback submit failed', err instanceof Error ? err.name : 'unknown error');
  }
  return Response.json({ ok: true }, { status: 202, headers: NO_STORE });
}
