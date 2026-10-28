import { and, eq, gt, isNull } from 'drizzle-orm';
import { accountInvites, betaApplications, emailSends } from '@/lib/licensing/db/schema';
import { escapeHtml, type Mail } from '@/lib/licensing/email';
import { hashLinkToken, isRateLimited, looksLikeLinkToken, newLinkToken, type Deps } from '@/lib/licensing/service';
import type { Session } from '@/lib/beta-access/service';

export const INVITE_TTL_MS = 7 * 86_400_000;

const nowOf = (deps: Pick<Deps, 'now'>) => deps.now?.() ?? new Date();

export function accountInviteEmail(input: { url: string; expiresAt: Date }): Omit<Mail, 'to'> {
  const expires = input.expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const text = [
    'You asked to create an Astrea Labs account. Open the link below to finish. You sign in with a one-time code we email you; there is no password.',
    '',
    input.url,
    '',
    `The link works once and expires on ${expires}. Don't forward this email.`,
    '',
    "Didn't ask for this? Ignore this email and no account is created.",
    '',
    '— Astrea Labs',
  ].join('\n');
  const html = `<p>You asked to create an Astrea Labs account. Open the link below to finish. You sign in with a one-time code we email you; there is no password.</p><p><a href="${escapeHtml(input.url)}">${escapeHtml(input.url)}</a></p><p>The link works once and expires on ${escapeHtml(expires)}. Don't forward this email.</p><p>Didn't ask for this? Ignore this email and no account is created.</p><p>— Astrea Labs</p>`;
  return { subject: 'Create your Astrea Labs account', text, html, secret: true };
}

export type OfferResult = 'sent' | 'queued' | 'rate_limited' | 'not_eligible';

/**
 * Remember a confirmed applicant's account request until approval, or email an invite
 * immediately when the application is already approved. The invite is bound to that address.
 */
export async function offerInvite(deps: Deps, session: Session | null): Promise<OfferResult> {
  const app = session?.application;
  if (!app || !app.emailConfirmedAt) return 'not_eligible';
  if (app.status !== 'submitted' && app.status !== 'approved') return 'not_eligible';
  if (app.status === 'submitted') {
    const [queued] = await deps.db
      .update(betaApplications)
      .set({ accountRequested: true })
      .where(and(eq(betaApplications.id, app.id), eq(betaApplications.status, 'submitted')))
      .returning({ id: betaApplications.id });
    if (queued) return 'queued';
    // Approval may have completed since this session was read. Re-read the state and
    // issue the link here so a concurrent approval cannot strand the request.
    const [current] = await deps.db
      .select({ status: betaApplications.status })
      .from(betaApplications)
      .where(eq(betaApplications.id, app.id))
      .limit(1);
    if (current?.status !== 'approved') return 'not_eligible';
  }
  const [requested] = await deps.db
    .update(betaApplications)
    .set({ accountRequested: true })
    .where(and(eq(betaApplications.id, app.id), eq(betaApplications.status, 'approved')))
    .returning({ id: betaApplications.id });
  if (!requested) return 'not_eligible';
  const email = app.email;
  if (await isRateLimited(deps, email)) return 'rate_limited';

  const { url, expiresAt } = await createInvite(deps, { email, applicationId: app.id });
  await deps.mailer.send({ to: email, ...accountInviteEmail({ url, expiresAt }) });
  await deps.db.insert(emailSends).values({ email, kind: 'account-invite', sentAt: nowOf(deps) });
  return 'sent';
}

/**
 * Store a single-use invite bound to `email` and return its join link. The caller sends it, only
 * to that address. Only for an address the applicant confirmed.
 */
export async function createInvite(
  deps: Pick<Deps, 'db' | 'now' | 'siteUrl'>,
  input: { email: string; applicationId: string; ttlMs?: number },
): Promise<{ url: string; expiresAt: Date }> {
  const token = newLinkToken();
  const expiresAt = new Date(nowOf(deps).getTime() + (input.ttlMs ?? INVITE_TTL_MS));
  await deps.db
    .insert(accountInvites)
    .values({ email: input.email, applicationId: input.applicationId, tokenHash: hashLinkToken(token), expiresAt });
  return { url: `${deps.siteUrl}/account/join?t=${token}`, expiresAt };
}

export type InviteState = 'valid' | 'used' | 'expired' | 'invalid';

/** Read-only check for the landing page. A GET (or an email scanner's prefetch) never spends the token. */
export async function peekInvite(deps: Pick<Deps, 'db' | 'now'>, token: unknown): Promise<InviteState> {
  if (!looksLikeLinkToken(token)) return 'invalid';
  const [invite] = await deps.db.select().from(accountInvites).where(eq(accountInvites.tokenHash, hashLinkToken(token))).limit(1);
  if (!invite) return 'invalid';
  if (invite.usedAt) return 'used';
  return invite.expiresAt > nowOf(deps) ? 'valid' : 'expired';
}

export type ConsumeResult = { ok: true; email: string; inviteId: string } | { ok: false; reason: Exclude<InviteState, 'valid'> };

/** Spend an invite: one conditional UPDATE, so of two concurrent requests exactly one wins. */
export async function consumeInvite(deps: Pick<Deps, 'db' | 'now'>, token: unknown): Promise<ConsumeResult> {
  if (!looksLikeLinkToken(token)) return { ok: false, reason: 'invalid' };
  const hash = hashLinkToken(token);
  const now = nowOf(deps);
  const [won] = await deps.db
    .update(accountInvites)
    .set({ usedAt: now })
    .where(and(eq(accountInvites.tokenHash, hash), isNull(accountInvites.usedAt), gt(accountInvites.expiresAt, now)))
    .returning({ id: accountInvites.id, email: accountInvites.email });
  if (won) return { ok: true, email: won.email, inviteId: won.id };
  const state = await peekInvite(deps, token);
  return { ok: false, reason: state === 'valid' ? 'used' : state };
}

/** Give a spent invite back after the account could not be created, so the link can be retried. */
export async function releaseInvite(deps: Pick<Deps, 'db'>, inviteId: string): Promise<void> {
  await deps.db.update(accountInvites).set({ usedAt: null }).where(eq(accountInvites.id, inviteId));
}
