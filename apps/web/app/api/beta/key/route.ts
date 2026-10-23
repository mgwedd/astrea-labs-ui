import { z } from 'zod';
import { betaDeps, errType, isSameOriginJson, json, sessionCookie } from '@/lib/beta-access/server';
import { revealKey } from '@/lib/beta-access/service';

const Body = z.object({ t: z.string().max(100) });

// The key page POSTs the emailed key-link token here. The key is shown once:
// the link is consumed in the same request. When the license came from a
// signed application, a 1h session for the signed copy is set too.
export async function POST(request: Request) {
  const deps = betaDeps(request);
  if (!isSameOriginJson(request, deps.siteUrl)) return json({ error: 'invalid' }, 410);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'invalid' }, 410);
  try {
    const r = await revealKey(deps, parsed.data.t);
    if (!r.ok) return json({ error: r.reason }, 410);
    const headers: Record<string, string> = r.session
      ? { 'Set-Cookie': sessionCookie(r.session.token, (r.session.expiresAt.getTime() - Date.now()) / 1000) }
      : {};
    return json(
      { token: r.token, expiresAt: r.expiresAt?.toISOString() ?? null, downloadUrl: r.downloadUrl, hasDocument: r.hasDocument },
      200,
      headers,
    );
  } catch (err) {
    console.error('beta key reveal failed', errType(err));
    return json({ error: 'unavailable' }, 502);
  }
}
