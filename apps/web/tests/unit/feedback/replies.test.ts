// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/lib/feedback/db/schema';
import { feedbackSubmissions } from '@/lib/feedback/db/schema';
import type { Mail } from '@/lib/licensing/email';
import { listReplies, replyEmail, replyToReporter } from '@/lib/feedback/replies';
import { listSubmissions, statusCounts, type Db, type Deps } from '@/lib/feedback/service';

const CREATE_TABLES = `
create table feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  status text not null default 'unconfirmed',
  email text not null,
  project_slug text not null,
  type text not null,
  title text not null,
  fields jsonb not null,
  flagged boolean not null default false,
  flag_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  issue_number integer,
  issue_url text
);
create table feedback_replies (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references feedback_submissions(id) on delete cascade,
  body text not null,
  sent_by text not null,
  sent_at timestamptz not null default now()
);`;

let sent: Mail[];
let deps: Deps;
let db: Db;
let failSend = false;
let n = 0;

async function insert(over: Partial<typeof feedbackSubmissions.$inferInsert> = {}) {
  const [row] = await db
    .insert(feedbackSubmissions)
    .values({
      tokenHash: `hash-${n++}`,
      status: 'pending_review',
      email: 'reporter@example.com',
      projectSlug: 'aletheia',
      type: 'bug',
      title: 'Crash <on> stop',
      fields: {},
      expiresAt: new Date('2030-01-01'),
      confirmedAt: new Date('2026-11-01'),
      ...over,
    })
    .returning();
  return row;
}

beforeEach(async () => {
  const pg = new PGlite();
  await pg.exec(CREATE_TABLES);
  db = drizzle(pg, { schema }) as unknown as Db;
  sent = [];
  failSend = false;
  deps = {
    db,
    baseUrl: 'https://astrealabs.com',
    now: () => new Date('2026-11-02T10:00:00Z'),
    mailer: {
      send: async (m) => {
        if (failSend) throw new Error('resend down');
        sent.push(m);
      },
    },
  };
});

describe('replyToReporter', () => {
  it('emails the reporter and records the message in the thread', async () => {
    const s = await insert();
    expect(await replyToReporter(deps, { submissionId: s.id, body: 'We are on it <b>', sentBy: 'admin@example.com' })).toBe('sent');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('reporter@example.com');
    expect(sent[0].subject).toContain('Re: Crash <on> stop');
    expect(sent[0].html).toContain('We are on it &lt;b&gt;'); // escaped in HTML
    expect(sent[0].html).not.toContain('admin@example.com');
    expect(sent[0].text).toContain('We are on it <b>');
    const thread = await listReplies(deps, s.id);
    expect(thread).toMatchObject([{ body: 'We are on it <b>', sentBy: 'admin@example.com' }]);
  });

  it('keeps the history oldest first', async () => {
    const s = await insert();
    let t = 0;
    deps.now = () => new Date(Date.UTC(2026, 10, 2, 10, t++));
    await replyToReporter(deps, { submissionId: s.id, body: 'first', sentBy: 'a@example.com' });
    await replyToReporter(deps, { submissionId: s.id, body: 'second', sentBy: 'a@example.com' });
    expect((await listReplies(deps, s.id)).map((r) => r.body)).toEqual(['first', 'second']);
  });

  it('records nothing when the mailer fails', async () => {
    const s = await insert();
    failSend = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await replyToReporter(deps, { submissionId: s.id, body: 'hello', sentBy: 'a@example.com' })).toBe('send_failed');
    expect(await listReplies(deps, s.id)).toEqual([]);
  });

  it('refuses without a confirmed email on record, and for an unknown submission', async () => {
    const unconfirmed = await insert({ status: 'unconfirmed', confirmedAt: null });
    const blank = await insert({ email: '  ' });
    for (const id of [unconfirmed.id, blank.id]) {
      expect(await replyToReporter(deps, { submissionId: id, body: 'hi', sentBy: 'a@example.com' })).toBe('no_email');
    }
    expect(await replyToReporter(deps, { submissionId: crypto.randomUUID(), body: 'hi', sentBy: 'a@example.com' })).toBe('not_found');
    expect(sent).toHaveLength(0);
  });

  it('builds a reply that names the report, not the admin', () => {
    const m = replyEmail({ projectSlug: 'aletheia', title: 'Crash', body: 'Hi' });
    expect(m.subject).toBe('Re: Crash (Aletheia)');
  });
});

describe('inbox filters and counts', () => {
  it('filters by type and project and counts by status', async () => {
    await insert({ type: 'bug' });
    await insert({ type: 'feature' });
    await insert({ type: 'bug', projectSlug: 'eido' });
    await insert({ status: 'rejected' });
    expect(await listSubmissions(deps, 'pending_review', { type: 'bug' })).toHaveLength(2);
    expect(await listSubmissions(deps, 'pending_review', { type: 'bug', project: 'eido' })).toHaveLength(1);
    expect(await statusCounts(deps)).toEqual({ unconfirmed: 0, pending_review: 3, creating: 0, approved: 0, rejected: 1 });
  });
});
