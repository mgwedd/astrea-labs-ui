import { checkBotId } from 'botid/server';
import { z } from 'zod';
import { betaDeps, errType, isSameOriginJson, json, readSessionCookie, requestMeta } from '@/lib/beta-access/server';
import { sign } from '@/lib/beta-access/service';
import { strokesSchema } from '@/lib/agreements/signed/drawn';

const Body = z.object({
  name: z.string().min(1).max(200),
  consentEsignAt: z.iso.datetime({ offset: true }),
  strokes: strokesSchema,
  createAccount: z.boolean().optional(),
});

const STATUS = {
  session: 401,
  already_signed: 409,
  name_mismatch: 400,
  not_viewed: 400,
  consent_stale: 400,
  terms_changed: 409,
  system: 500,
} as const;

// Sign and apply. Needs the signing-session cookie. The application is
// submitted only once the signed PDF, audit JSON and evidence row are all stored.
export async function POST(request: Request) {
  const verdict = await checkBotId();
  if (verdict.isBot) return json({ error: 'blocked' }, 403);
  const deps = betaDeps(request);
  if (!isSameOriginJson(request, deps.siteUrl)) return json({ error: 'invalid' }, 400);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'invalid' }, 400);
  try {
    const r = await sign(deps, readSessionCookie(request), parsed.data, requestMeta(request));
    if (!r.ok) {
      if (r.error === 'system') console.error(`beta sign failed at ${r.step}`);
      return json(r.error === 'system' ? { error: r.error, step: r.step } : { error: r.error }, STATUS[r.error]);
    }
    return json({ ok: true });
  } catch (err) {
    console.error('beta sign failed', errType(err));
    return json({ error: 'system', step: 'unknown' }, 500);
  }
}
