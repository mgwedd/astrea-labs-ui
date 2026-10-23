// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/lib/feedback/db/schema';
import { feedbackSubmissions } from '@/lib/feedback/db/schema';
import type { Mail } from '@/lib/licensing/email';
import { issueBody, neutralise } from '@/lib/feedback/issue';
import { approveSubmission, confirmFeedback, getSubmission, hashToken, LINK_TTL_MS, listSubmissions, RATE_LIMIT, rejectSubmission, submitFeedback, type Db, type Deps } from '@/lib/feedback/service';
import { FEEDBACK_PROJECTS } from '@/lib/feedback/projects';
import { clearTokenCache } from '@/lib/feedback/github';
import { generateKeyPairSync } from 'node:crypto';
import { FeedbackSchema } from '@/lib/feedback/validation';

const CREATE_TABLE = `
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
create index feedback_submissions_email_created_idx on feedback_submissions (email, created_at);
create index feedback_submissions_status_idx on feedback_submissions (status);`;

const bug = {
  project: 'aletheia',
  type: 'bug' as const,
  title: 'Crash on stop',
  email: 'Reporter@Example.com',
  ack: true,
  happened: 'It crashed.',
  steps: '1. Record\n2. Stop',
  expected: 'No crash.',
  environment: 'macOS 15, 0.4.1',
};
const feature = {
  project: 'aletheia',
  type: 'feature' as const,
  title: 'Dark mode',
  email: 'reporter@example.com',
  ack: true,
  problem: 'Bright at night.',
  solution: 'A dark theme.',
};

let sent: Mail[];
let clock: Date;
let deps: Deps;
let db: Db;
const fetchMock = vi.fn();
const TEST_PEM = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const exp = () => new Date(Date.now() + 3_600_000).toISOString();
/** Mocks the App flow (installation, token) then the issue POST. */
function ghApp(issueNumber = 7, issueStatus = 201) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith('/installation')) return json({ id: 99 });
    if (url.includes('/access_tokens')) return json({ token: 'inst-token', expires_at: exp() }, 201);
    return json({ number: issueNumber, html_url: `https://github.com/mgwedd/aletheia/issues/${issueNumber}` }, issueStatus);
  });
}
const issueCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/issues'));

const tokenIn = (m: Mail) => m.text.match(/token=([\w-]+)/)![1];
beforeEach(async () => {
  const pg = new PGlite();
  await pg.exec(CREATE_TABLE);
  db = drizzle(pg, { schema }) as unknown as Db;
  sent = [];
  clock = new Date('2026-11-01T12:00:00Z');
  deps = { db, mailer: { send: async (m) => void sent.push(m) }, baseUrl: 'https://astrealabs.com', now: () => clock };
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  process.env.GITHUB_APP_ID = '123';
  process.env.GITHUB_APP_PRIVATE_KEY = TEST_PEM;
  clearTokenCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('validation', () => {
  it('accepts a bug and a feature, lowercasing the email', () => {
    const b = FeedbackSchema.parse(bug);
    expect(b.email).toBe('reporter@example.com');
    expect(FeedbackSchema.safeParse(feature).success).toBe(true);
  });
  it('requires the per-type fields', () => {
    expect(FeedbackSchema.safeParse({ ...bug, steps: '' }).success).toBe(false);
    expect(FeedbackSchema.safeParse({ ...feature, solution: '' }).success).toBe(false);
    expect(FeedbackSchema.safeParse({ ...feature, type: 'bug' }).success).toBe(false);
  });
  it('enforces length limits', () => {
    expect(FeedbackSchema.safeParse({ ...bug, title: 'x'.repeat(121) }).success).toBe(false);
    expect(FeedbackSchema.safeParse({ ...bug, title: 'x'.repeat(120) }).success).toBe(true);
    expect(FeedbackSchema.safeParse({ ...bug, happened: 'x'.repeat(4001) }).success).toBe(false);
    expect(FeedbackSchema.safeParse({ ...feature, alternatives: 'x'.repeat(2001) }).success).toBe(false);
  });
  it('rejects bad project, bad and disposable email', () => {
    expect(FeedbackSchema.safeParse({ ...bug, project: 'nope' }).success).toBe(false);
    expect(FeedbackSchema.safeParse({ ...bug, email: 'not-an-email' }).success).toBe(false);
    expect(FeedbackSchema.safeParse({ ...bug, email: 'a@mailinator.com' }).success).toBe(false);
  });
  it('requires the patient-information tick', () => {
    expect(FeedbackSchema.safeParse({ ...bug, ack: false }).success).toBe(false);
    const { ack: _a, ...noAck } = feature;
    expect(FeedbackSchema.safeParse(noAck).success).toBe(false);
  });
  it('only offers projects with a confirmed repo', () => {
    expect(FEEDBACK_PROJECTS.map((p) => p.slug)).toContain('aletheia');
    expect(FEEDBACK_PROJECTS.map((p) => p.slug)).not.toContain('elenchos');
  });
});

describe('submit', () => {
  it('stores a pending row, mails one confirm link, stores only the hash, posts nothing', async () => {
    expect(await submitFeedback(deps, FeedbackSchema.parse(bug))).toBe('pending');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('reporter@example.com');
    const token = tokenIn(sent[0]);
    expect(token).toMatch(/^[\w-]{43}$/); // 32 bytes base64url
    const [row] = await db.select().from(feedbackSubmissions);
    expect(row.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.status).toBe('unconfirmed');
    expect(row.flagged).toBe(false);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(LINK_TTL_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rate limits per email: no row, no mail past the hourly cap', async () => {
    const input = FeedbackSchema.parse(feature);
    for (let i = 0; i < RATE_LIMIT.perHour; i++) expect(await submitFeedback(deps, input)).toBe('pending');
    expect(await submitFeedback(deps, input)).toBe('rate_limited');
    expect(sent).toHaveLength(RATE_LIMIT.perHour);
    expect(await submitFeedback(deps, FeedbackSchema.parse({ ...feature, email: 'other@example.com' }))).toBe('pending');
  });

  it('enforces the daily cap across hours', async () => {
    const input = FeedbackSchema.parse(feature);
    for (let i = 0; i < RATE_LIMIT.perDay; i++) {
      clock = new Date(clock.getTime() + 30 * 60_000 + 1); // at most 2/hour
      expect(await submitFeedback(deps, input)).toBe('pending');
    }
    clock = new Date(clock.getTime() + 61 * 60_000);
    expect(await submitFeedback(deps, input)).toBe('rate_limited');
  });

  it('flags (without stripping) a URL or image syntax', async () => {
    await submitFeedback(deps, FeedbackSchema.parse({ ...bug, happened: 'see https://x.test/a.png ![shot](a.png)' }));
    const [row] = await db.select().from(feedbackSubmissions);
    expect(row.flagged).toBe(true);
    expect(row.flagReason).toContain('URL');
    expect(row.flagReason).toContain('image');
    expect(row.fields.happened).toContain('https://x.test/a.png');
  });

  it('deletes unconfirmed rows older than 7 days', async () => {
    await submitFeedback(deps, FeedbackSchema.parse(feature));
    clock = new Date(clock.getTime() + 8 * 86_400_000);
    await submitFeedback(deps, FeedbackSchema.parse({ ...feature, email: 'b@example.com' }));
    const rows = await db.select().from(feedbackSubmissions);
    expect(rows.map((r) => r.email)).toEqual(['b@example.com']);
  });
});

describe('confirm, review, approve', () => {
  async function confirmed(input: object = bug) {
    await submitFeedback(deps, FeedbackSchema.parse(input));
    const token = tokenIn(sent[sent.length - 1]);
    expect(await confirmFeedback(deps, token)).toEqual({ status: 'received' });
    const [row] = await db.select().from(feedbackSubmissions);
    return { token, id: row.id };
  }

  it('confirm holds for review and does not call GitHub', async () => {
    const { token } = await confirmed();
    const [row] = await db.select().from(feedbackSubmissions);
    expect(row.status).toBe('pending_review');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await confirmFeedback(deps, token)).toEqual({ status: 'already' });
    expect((await listSubmissions(deps, 'pending_review')).length).toBe(1);
    expect(JSON.stringify(await listSubmissions(deps))).not.toContain('tokenHash');
  });

  it('rejects an expired link and an unknown token', async () => {
    await submitFeedback(deps, FeedbackSchema.parse(bug));
    const token = tokenIn(sent[0]);
    clock = new Date(clock.getTime() + LINK_TTL_MS + 1);
    expect(await confirmFeedback(deps, token)).toEqual({ status: 'expired' });
    expect(await confirmFeedback(deps, 'x'.repeat(43))).toEqual({ status: 'invalid' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('approve calls GitHub once with the App token, labels, and stores number and url', async () => {
    ghApp(7);
    const { id } = await confirmed();
    const res = await approveSubmission(deps, id);
    expect(res).toEqual({ status: 'approved', issueUrl: 'https://github.com/mgwedd/aletheia/issues/7', issueNumber: 7 });
    expect(issueCalls()).toHaveLength(1);
    const [url, init] = issueCalls()[0];
    expect(url).toBe('https://api.github.com/repos/mgwedd/aletheia/issues');
    expect(init.headers.Authorization).toBe('Bearer inst-token');
    const payload = JSON.parse(init.body);
    expect(payload.labels).toEqual(['bug', 'from-website']);
    expect(payload.title).toBe('Crash on stop');
    const [row] = await db.select().from(feedbackSubmissions);
    expect([row.status, row.issueNumber]).toEqual(['approved', 7]);
  });

  it('applies admin edits to the issue', async () => {
    ghApp();
    const { id } = await confirmed();
    await approveSubmission(deps, id, { title: 'Edited', body: 'Cleaned body', labels: ['bug'] });
    expect(JSON.parse(issueCalls()[0][1].body)).toEqual({ title: 'Edited', body: 'Cleaned body', labels: ['bug'] });
  });

  it('never puts the email in the issue', async () => {
    ghApp();
    const { id } = await confirmed();
    await approveSubmission(deps, id);
    expect(issueCalls()[0][1].body.toLowerCase()).not.toContain('reporter@example.com');
    const { email: _e, ack: _a, ...content } = FeedbackSchema.parse(bug);
    const body = issueBody(content);
    expect(body.toLowerCase()).not.toContain('example.com');
    expect(body).toContain('Submitted via astrealabs.com/feedback');
    expect((await getSubmission(deps, id))!.draft.body).not.toContain('example.com');
  });

  it('a double approve creates no second issue', async () => {
    ghApp(9);
    const { id } = await confirmed();
    await approveSubmission(deps, id);
    expect(await approveSubmission(deps, id)).toMatchObject({ status: 'already', issueNumber: 9 });
    expect(issueCalls()).toHaveLength(1);
  });

  it('concurrent approves create one issue', async () => {
    ghApp(3);
    const { id } = await confirmed();
    const results = await Promise.all([approveSubmission(deps, id), approveSubmission(deps, id)]);
    expect(issueCalls()).toHaveLength(1);
    expect(results.map((r) => r.status).sort()).toEqual(['approved', expect.stringMatching(/already|in_progress/)].sort());
  });

  it('cannot approve an unconfirmed submission', async () => {
    ghApp();
    await submitFeedback(deps, FeedbackSchema.parse(bug));
    const [row] = await db.select().from(feedbackSubmissions);
    expect(await approveSubmission(deps, row.id)).toEqual({ status: 'not_reviewable' });
    expect(await approveSubmission(deps, '00000000-0000-4000-8000-000000000000')).toEqual({ status: 'not_found' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reject closes it without calling GitHub, and it cannot then be approved', async () => {
    ghApp();
    const { id } = await confirmed();
    expect(await rejectSubmission(deps, id, 'spam')).toEqual({ status: 'rejected' });
    const [row] = await db.select().from(feedbackSubmissions);
    expect([row.status, row.reviewNote]).toEqual(['rejected', 'spam']);
    expect(await approveSubmission(deps, id)).toEqual({ status: 'not_reviewable' });
    expect(await rejectSubmission(deps, id)).toEqual({ status: 'not_reviewable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries without labels on a 422', async () => {
    let n = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/installation')) return json({ id: 99 });
      if (url.includes('/access_tokens')) return json({ token: 'inst-token', expires_at: exp() }, 201);
      return n++ === 0 ? json({}, 422) : json({ number: 5, html_url: 'https://github.com/mgwedd/aletheia/issues/5' }, 201);
    });
    const { id } = await confirmed(feature);
    expect((await approveSubmission(deps, id)).status).toBe('approved');
    expect(issueCalls()).toHaveLength(2);
    expect(JSON.parse(issueCalls()[0][1].body).labels).toEqual(['enhancement', 'from-website']);
    expect(JSON.parse(issueCalls()[1][1].body).labels).toBeUndefined();
  });

  it('releases the claim when GitHub fails so approve can be retried', async () => {
    ghApp(1, 500);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { id } = await confirmed();
    expect(await approveSubmission(deps, id)).toEqual({ status: 'failed' });
    ghApp(11);
    expect((await approveSubmission(deps, id)).status).toBe('approved');
  });

  it('without the App configured in development, logs instead of calling GitHub', async () => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
    vi.stubEnv('NODE_ENV', 'development');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { id } = await confirmed();
    expect((await approveSubmission(deps, id)).status).toBe('approved');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });
});

describe('GitHub App token flow', () => {
  it('signs an RS256 JWT, finds the installation, requests a one-repo issues:write token, and caches it', async () => {
    ghApp();
    const { getGitHubToken } = await import('@/lib/feedback/github');
    expect(await getGitHubToken('mgwedd', 'aletheia')).toBe('inst-token');
    expect(await getGitHubToken('mgwedd', 'aletheia')).toBe('inst-token');
    expect(fetchMock).toHaveBeenCalledTimes(2); // installation + access_tokens, once

    const [instUrl, instInit] = fetchMock.mock.calls[0];
    expect(instUrl).toBe('https://api.github.com/repos/mgwedd/aletheia/installation');
    const jwt = instInit.headers.Authorization.replace('Bearer ', '');
    const [h, p, sig] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(JSON.parse(Buffer.from(p, 'base64url').toString()).iss).toBe('123');
    const { createPublicKey, createVerify } = await import('node:crypto');
    const ok = createVerify('RSA-SHA256').update(`${h}.${p}`).verify(createPublicKey(TEST_PEM), Buffer.from(sig, 'base64url'));
    expect(ok).toBe(true);

    const [tokUrl, tokInit] = fetchMock.mock.calls[1];
    expect(tokUrl).toBe('https://api.github.com/app/installations/99/access_tokens');
    expect(JSON.parse(tokInit.body)).toEqual({ permissions: { issues: 'write', metadata: 'read' }, repositories: ['aletheia'] });
  });

  it('refreshes a token that is within 5 minutes of expiry', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/installation') ? json({ id: 99 }) : json({ token: 't', expires_at: new Date(Date.now() + 4 * 60_000).toISOString() }, 201),
    );
    const { getGitHubToken } = await import('@/lib/feedback/github');
    await getGitHubToken('mgwedd', 'aletheia');
    await getGitHubToken('mgwedd', 'aletheia');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('mention neutralising', () => {
  it('breaks @mentions, team mentions, issue refs and HTML', () => {
    const out = neutralise('hi @octocat and @org/team, see #12 <script>');
    expect(out).not.toMatch(/@[A-Za-z]/);
    expect(out).toContain('@\u200Doctocat');
    expect(out).not.toMatch(/#\d/);
    expect(out).not.toContain('<script>');
  });
  it('applies to every field of the body', () => {
    const { email: _e, ack: _a, ...content } = FeedbackSchema.parse({ ...bug, happened: 'cc @someone', steps: '@a', expected: '@b', environment: '@c' });
    expect(issueBody(content)).not.toMatch(/@[A-Za-z]/);
  });
});
