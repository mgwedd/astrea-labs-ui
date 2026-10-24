import { z } from 'zod';
import { betaDeps, errType, isSameOriginJson, json, requestMeta, sessionCookie } from '@/lib/beta-access/server';
import { revealKey } from '@/lib/beta-access/service';

const iso = z.string().max(40);
const Body = z.object({
  t: z.string().max(100),
  // A renewal's C2 confirmation (spec G).
  attestation: z
    .object({ version: z.string().max(40), shownAt: iso, tickedAt: z.record(z.string().max(10), iso), sentAt: iso.optional() })
    .optional(),
});

// The key page POSTs the emailed key-link token here. The key is shown once:
// the link is consumed in the same request. When the license came from a
// signed application, a 1h session for the signed copy is set too.
// A renewed key needs the licensee to confirm C2 again: 409 asks for it,
// and the link stays unused until it is given.
export async function POST(request: Request) {
  const deps = betaDeps(request);
  if (!isSameOriginJson(request, deps.siteUrl)) return json({ error: 'invalid' }, 410);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'invalid' }, 410);
  try {
    const r = await revealKey(deps, parsed.data.t, parsed.data.attestation, requestMeta(request));
    if (!r.ok) {
      const status = r.reason === 'attestation_required' ? 409 : r.reason === 'attestation_invalid' ? 400 : 410;
      return json({ error: r.reason }, status);
    }
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
