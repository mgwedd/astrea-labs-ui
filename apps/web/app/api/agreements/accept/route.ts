import { checkBotId } from 'botid/server';
import { siteUrlFor } from '@/lib/licensing/server';
import { errType, isSameOriginJson, json, requestMeta } from '@/lib/beta-access/server';
import { getAgreement } from '@/lib/agreements/registry';
import { agreementDeps } from '@/lib/agreements/server';
import { acceptAgreement, type AcceptError } from '@/lib/agreements/service';
import { AcceptSchema } from '@/lib/agreements/validation';

const STATUS: Record<AcceptError, number> = {
  not_simple: 400,
  stale_version: 409,
  missing_required: 400,
  unknown_box: 400,
  bad_time: 400,
  rate_limited: 429,
};

// Simple accept from a public page. The email is typed, not proven, so the row
// says subject_verified = false. Apps with accounts should call
// acceptAgreement() server-side with the signed-in user and subjectVerified: true.
export async function POST(request: Request) {
  if (!isSameOriginJson(request, siteUrlFor(request))) return json({ error: 'bad_origin' }, 403);
  const verdict = await checkBotId();
  if (verdict.isBot) return json({ error: 'bot' }, 403);

  const parsed = AcceptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'invalid' }, 400);
  const definition = getAgreement(parsed.data.agreementId);
  if (!definition) return json({ error: 'not_found' }, 404);

  try {
    const outcome = await acceptAgreement(agreementDeps(), {
      definition,
      version: parsed.data.version,
      subject: parsed.data.email,
      subjectVerified: false,
      shownAt: parsed.data.shownAt,
      tickedAt: parsed.data.tickedAt,
      sentAt: parsed.data.sentAt,
      meta: requestMeta(request),
    });
    if (!outcome.ok) return json({ error: outcome.error }, STATUS[outcome.error]);
    return json({ ok: true, id: outcome.id, acceptedAt: outcome.acceptedAt.toISOString() }, 201);
  } catch (err) {
    // Error type only: Drizzle messages include query params (the email).
    console.error('agreement accept failed', errType(err));
    return json({ error: 'server' }, 500);
  }
}
