// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/lib/licensing/db/schema';
import { INVITE_TTL_MS, consumeInvite, offerInvite, peekInvite, releaseInvite } from '@/lib/accounts/invites';
import type { Mail } from '@/lib/licensing/email';
import { RATE_LIMIT, type Db, type Deps } from '@/lib/licensing/service';
import type { Session } from '@/lib/beta-access/service';

let sent: Mail[];
let clock: Date;
let deps: Deps;

const session = async (over: Partial<{ email: string; emailConfirmedAt: Date | null; status: 'draft' | 'submitted' | 'approved' | 'declined' }> = {}) => {
  const [application] = await deps.db
    .insert(schema.betaApplications)
    .values({
      id: crypto.randomUUID(),
      email: over.email ?? 'dr@example.com',
      answers: {},
      consents: [],
      status: over.status ?? 'approved',
      emailConfirmedAt: over.emailConfirmedAt === undefined ? new Date('2026-11-01T00:00:00Z') : over.emailConfirmedAt,
    })
    .returning();
  return { kind: 'signed', application } as unknown as Session;
};

const tokenFrom = (mail: Mail) => mail.text.match(/t=([A-Za-z0-9_-]{43})/)![1];

beforeEach(async () => {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, '../../../drizzle') });
  sent = [];
  clock = new Date('2026-11-01T12:00:00Z');
  deps = {
    db: db as unknown as Db,
    mailer: { send: async (m) => void sent.push(m) },
    siteUrl: 'https://astrealabs.com',
    now: () => clock,
  } as Deps;
});

describe('offerInvite', () => {
  it('emails the invite to the application address only', async () => {
    expect(await offerInvite(deps, await session())).toBe('sent');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('dr@example.com');
    expect(sent[0].text).toContain('https://astrealabs.com/account/join?t=');
  });
  it('offers nothing without a session or an unconfirmed email', async () => {
    expect(await offerInvite(deps, null)).toBe('not_eligible');
    expect(await offerInvite(deps, await session({ emailConfirmedAt: null }))).toBe('not_eligible');
    expect(sent).toHaveLength(0);
  });
  it('queues a submitted applicant account request until approval', async () => {
    const [app] = await deps.db.insert(schema.betaApplications).values({ id: crypto.randomUUID(), email: 'pending@example.com', answers: {}, consents: [], status: 'submitted', emailConfirmedAt: clock }).returning();
    expect(await offerInvite(deps, { kind: 'signing', application: app })).toBe('queued');
    const [saved] = await deps.db.select().from(schema.betaApplications);
    expect(saved.accountRequested).toBe(true);
    expect(sent).toHaveLength(0);
    expect(await deps.db.select().from(schema.accountInvites)).toHaveLength(0);
  });
  it('does not invite draft or declined applicants', async () => {
    expect(await offerInvite(deps, await session({ status: 'draft' }))).toBe('not_eligible');
    expect(await offerInvite(deps, await session({ status: 'declined' }))).toBe('not_eligible');
    expect(sent).toHaveLength(0);
  });
  it('is rate limited per address', async () => {
    const s = await session();
    for (let i = 0; i < RATE_LIMIT.perHour; i++) expect(await offerInvite(deps, s)).toBe('sent');
    expect(await offerInvite(deps, s)).toBe('rate_limited');
    expect(sent).toHaveLength(RATE_LIMIT.perHour);
  });
  it('does not rate limit retries after failed delivery', async () => {
    deps.mailer = { send: async () => { throw new Error('delivery failed'); } };
    const s = await session();
    for (let i = 0; i < RATE_LIMIT.perHour; i++) await expect(offerInvite(deps, s)).rejects.toThrow('delivery failed');
    expect(await deps.db.select().from(schema.emailSends)).toHaveLength(0);
    deps.mailer = { send: async (m) => void sent.push(m) };
    expect(await offerInvite(deps, s)).toBe('sent');
    expect(sent).toHaveLength(1);
  });
  it('stores only a hash of the token', async () => {
    await offerInvite(deps, await session());
    const [row] = await deps.db.select().from(schema.accountInvites);
    expect(row.tokenHash).not.toContain(tokenFrom(sent[0]));
    expect(row.email).toBe('dr@example.com');
  });
});

describe('consumeInvite', () => {
  it('returns the invited email and works once', async () => {
    await offerInvite(deps, await session());
    const token = tokenFrom(sent[0]);
    const first = await consumeInvite(deps, token);
    expect(first).toMatchObject({ ok: true, email: 'dr@example.com' });
    expect(await consumeInvite(deps, token)).toEqual({ ok: false, reason: 'used' });
  });
  it('lets exactly one of two concurrent requests win', async () => {
    await offerInvite(deps, await session());
    const token = tokenFrom(sent[0]);
    const results = await Promise.all([consumeInvite(deps, token), consumeInvite(deps, token)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });
  it('rejects an expired invite', async () => {
    await offerInvite(deps, await session());
    const token = tokenFrom(sent[0]);
    clock = new Date(clock.getTime() + INVITE_TTL_MS + 1000);
    expect(await consumeInvite(deps, token)).toEqual({ ok: false, reason: 'expired' });
    expect(await peekInvite(deps, token)).toBe('expired');
  });
  it('rejects unknown and malformed tokens', async () => {
    expect(await consumeInvite(deps, 'x'.repeat(43))).toEqual({ ok: false, reason: 'invalid' });
    expect(await consumeInvite(deps, 'short')).toEqual({ ok: false, reason: 'invalid' });
    expect(await consumeInvite(deps, undefined)).toEqual({ ok: false, reason: 'invalid' });
  });
  it('peek does not spend the token', async () => {
    await offerInvite(deps, await session());
    const token = tokenFrom(sent[0]);
    expect(await peekInvite(deps, token)).toBe('valid');
    expect(await peekInvite(deps, token)).toBe('valid');
    expect(await consumeInvite(deps, token)).toMatchObject({ ok: true });
  });
  it('can be released after a failed account creation, then retried', async () => {
    await offerInvite(deps, await session());
    const token = tokenFrom(sent[0]);
    const first = await consumeInvite(deps, token);
    if (!first.ok) throw new Error('expected ok');
    await releaseInvite(deps, first.inviteId);
    expect(await consumeInvite(deps, token)).toMatchObject({ ok: true });
  });
});
