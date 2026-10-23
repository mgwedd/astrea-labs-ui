import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

/** Constant-time check of "Authorization: Bearer <secret>". False if the secret is unset. */
export function hasBearer(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}
