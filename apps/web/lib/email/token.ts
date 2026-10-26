import { createHmac, timingSafeEqual } from 'node:crypto';

// Signed unsubscribe tokens: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
// They carry only the address and an expiry, so they work without a session.

export const TOKEN_TTL_MS = 2 * 365 * 24 * 60 * 60 * 1000;

type Payload = { e: string; x: number };

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const mac = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest();

function secretFromEnv(): string {
  const s = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (!s || s.length < 32) throw new Error('EMAIL_UNSUBSCRIBE_SECRET must be set (32+ characters)');
  return s;
}

export function signUnsubscribeToken(email: string, now = Date.now(), secret = secretFromEnv()): string {
  const payload: Payload = { e: email.trim().toLowerCase(), x: now + TOKEN_TTL_MS };
  const body = b64(JSON.stringify(payload));
  return `${body}.${b64(mac(body, secret))}`;
}

export type TokenResult = { ok: true; email: string } | { ok: false; reason: 'invalid' | 'expired' };

export function verifyUnsubscribeToken(token: unknown, now = Date.now(), secret = secretFromEnv()): TokenResult {
  if (typeof token !== 'string' || token.length > 1024) return { ok: false, reason: 'invalid' };
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return { ok: false, reason: 'invalid' };
  const given = Buffer.from(sig, 'base64url');
  const want = mac(body, secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return { ok: false, reason: 'invalid' };
  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (typeof payload.e !== 'string' || typeof payload.x !== 'number') return { ok: false, reason: 'invalid' };
  if (payload.x <= now) return { ok: false, reason: 'expired' };
  return { ok: true, email: payload.e };
}
