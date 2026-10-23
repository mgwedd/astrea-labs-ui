import { checkBotId } from 'botid/server';
import { z } from 'zod';
import { betaDeps, errType, isSameOriginJson, json } from '@/lib/beta-access/server';
import { resume } from '@/lib/beta-access/service';

const Body = z.object({ email: z.email().max(254) });

// "Resume signing": a fresh signing link if the address has an unsigned
// draft. 202 whatever the outcome.
export async function POST(request: Request) {
  const verdict = await checkBotId();
  if (verdict.isBot) return json({ error: 'blocked' }, 403);
  const deps = betaDeps(request);
  if (!isSameOriginJson(request, deps.siteUrl)) return json({ error: 'invalid' }, 400);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'invalid' }, 400);
  try {
    await resume(deps, parsed.data.email);
  } catch (err) {
    console.error('beta resume failed', errType(err));
    return json({ error: 'send_failed' }, 502);
  }
  return json({ ok: true }, 202);
}
