import { checkBotId } from 'botid/server';
import { applicationInputSchema } from '@/lib/beta-access/answers';
import { betaDeps, errType, isSameOriginJson, json } from '@/lib/beta-access/server';
import { apply } from '@/lib/beta-access/service';

// Apply: answers + consents in, a signing link emailed out. 202 for every
// valid input (new address, existing draft, already applied, rate-limited),
// so the reply never reveals whether an address has applied.
export async function POST(request: Request) {
  const verdict = await checkBotId();
  if (verdict.isBot) return json({ error: 'blocked' }, 403);
  const deps = betaDeps(request);
  if (!isSameOriginJson(request, deps.siteUrl)) return json({ error: 'invalid' }, 400);

  const parsed = applicationInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return json({ error: 'invalid', issues }, 400);
  }
  try {
    const outcome = await apply(deps, parsed.data);
    if (typeof outcome === 'object') return json({ error: 'invalid', issues: [{ path: 'consents', message: outcome.invalid }] }, 400);
  } catch (err) {
    console.error('beta apply failed', errType(err));
    return json({ error: 'send_failed' }, 502);
  }
  return json({ ok: true }, 202);
}
