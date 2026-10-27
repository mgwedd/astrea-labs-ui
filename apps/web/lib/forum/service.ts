// Members forum services. Every function takes its dependencies (db, clock, randomness) as the
// first argument so it runs the same against Neon in production and PGlite in tests.
// Access is NOT checked here except where a function says so: gate callers with requireForumMember().
import { and, asc, desc, eq, gt, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { projects as registryProjects } from '@astrea/research-registry';
import * as schema from './db/schema';
import {
  forumBookmarks,
  forumCategories,
  forumMentions,
  forumPosts,
  forumProfiles,
  forumReactions,
  forumStatusEvents,
  forumThreads,
  forumThreadViews,
  forumVotes,
  type DisplayMode,
  type ForumGroup,
  type ForumPost,
  type ForumProfile,
  type ForumThread,
} from './db/schema';
import { licenses } from '@/lib/licensing/db/schema';
import { extractMentionNames, MAX_BODY_CHARS, markdownToHtml, plainText, sanitizeBody, wrapMentions } from './content';
import { isValidUsername, randomHandle, usernameFromEmail } from './names';
import { ACTIVE_STATUSES, REPORT_STATUSES, THREAD_KINDS, isReportKind, type ReportStatus, type ThreadKind } from './reports';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema & Record<string, unknown>>;

export type Deps = {
  db: Db;
  now?: () => Date;
  random?: () => number;
  /** Projects to sync into categories. Defaults to packages/research-registry. */
  registry?: ReadonlyArray<{ slug: string; name: string }>;
};

/** The signed-in member making a call. `sub` is the Auth0 user id. Build it with requireForumMember(). */
export type Viewer = { sub: string; email: string; isAdmin: boolean };

export type ErrorCode = 'invalid' | 'not_found' | 'locked' | 'forbidden' | 'conflict';
export class ForumError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ForumError';
  }
}

const nowOf = (d: Pick<Deps, 'now'>) => d.now?.() ?? new Date();
const randomOf = (d: Pick<Deps, 'random'>) => d.random ?? Math.random;
const HOUR_MS = 3_600_000;
const isUuid = (v: string) => z.string().uuid().safeParse(v).success;

function parse<T extends z.ZodType>(schemaZ: T, input: unknown): z.infer<T> {
  const r = schemaZ.safeParse(input);
  if (!r.success) throw new ForumError('invalid', r.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '));
  return r.data;
}

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } } | undefined;
  return err?.code === '23505' || err?.cause?.code === '23505';
}

// ---------------------------------------------------------------- access

/**
 * True when `email` holds a license that is not revoked and not expired. Licenses are issued when
 * a beta application is approved, so this is "approved member". Admins skip this check in the gate.
 */
export async function hasForumLicense(deps: Pick<Deps, 'db' | 'now'>, email: string): Promise<boolean> {
  const now = nowOf(deps);
  const rows = await deps.db
    .select({ lid: licenses.lid })
    .from(licenses)
    .where(and(eq(licenses.email, email.trim().toLowerCase()), isNull(licenses.revokedAt), or(isNull(licenses.expiresAt), gt(licenses.expiresAt, now))))
    .limit(1);
  return rows.length > 0;
}

// ---------------------------------------------------------------- categories

export type CategoryRow = { id: string; slug: string; name: string; group: ForumGroup; sort: number; threadCount: number };

/**
 * Make sure a category exists for Aletheia and for every other project in the registry.
 * Aletheia is its own group; the rest are `projects`. The `lab` group has no categories until the
 * lab decides on some. Existing rows are never changed or removed.
 */
export async function syncCategories(deps: Pick<Deps, 'db' | 'registry'>): Promise<void> {
  const list = deps.registry ?? registryProjects;
  const existing = new Set((await deps.db.select({ slug: forumCategories.slug }).from(forumCategories)).map((c) => c.slug));
  const missing = list
    .map((p, i) => ({
      slug: p.slug,
      name: p.name,
      group: (p.slug === 'aletheia' ? 'aletheia' : 'projects') as ForumGroup,
      sort: p.slug === 'aletheia' ? 0 : i + 1,
    }))
    .filter((c) => !existing.has(c.slug));
  if (missing.length) await deps.db.insert(forumCategories).values(missing).onConflictDoNothing();
}

/** All categories, ordered by group (aletheia, projects, lab) then sort, each with its thread count. */
export async function listCategories(deps: Deps): Promise<CategoryRow[]> {
  await syncCategories(deps);
  const rows = await deps.db
    .select({
      id: forumCategories.id,
      slug: forumCategories.slug,
      name: forumCategories.name,
      group: forumCategories.group,
      sort: forumCategories.sort,
      threadCount: sql<number>`count(${forumThreads.id})::int`,
    })
    .from(forumCategories)
    .leftJoin(forumThreads, eq(forumThreads.categoryId, forumCategories.id))
    .groupBy(forumCategories.id)
    .orderBy(asc(forumCategories.sort), asc(forumCategories.name));
  const order: Record<ForumGroup, number> = { aletheia: 0, projects: 1, lab: 2 };
  return rows.sort((a, b) => order[a.group] - order[b.group] || a.sort - b.sort);
}

async function categoryBySlug(deps: Deps, slug: string) {
  await syncCategories(deps);
  const [c] = await deps.db.select().from(forumCategories).where(eq(forumCategories.slug, slug)).limit(1);
  if (!c) throw new ForumError('not_found', 'No such category');
  return c;
}

// ---------------------------------------------------------------- profiles

/** What a member sees of a profile (their own). */
export type OwnProfile = { username: string; handle: string; displayMode: DisplayMode; usernameConfirmed: boolean; displayName: string };

const displayNameOf = (p: Pick<ForumProfile, 'username' | 'handle' | 'displayMode'>) => (p.displayMode === 'handle' ? p.handle : p.username);
const ownProfile = (p: ForumProfile): OwnProfile => ({
  username: p.username,
  handle: p.handle,
  displayMode: p.displayMode,
  usernameConfirmed: p.usernameConfirmedAt !== null,
  displayName: displayNameOf(p),
});

async function nameTaken(deps: Pick<Deps, 'db'>, name: string, exceptSub?: string): Promise<boolean> {
  const rows = await deps.db
    .select({ sub: forumProfiles.auth0Sub })
    .from(forumProfiles)
    .where(or(eq(forumProfiles.username, name), eq(forumProfiles.handle, name)));
  return rows.some((r) => r.sub !== exceptSub);
}

/** A handle nobody has. Retries on collision, then falls back to a numeric suffix. */
export async function generateUniqueHandle(deps: Pick<Deps, 'db' | 'random'>): Promise<string> {
  const rnd = randomOf(deps);
  for (let i = 0; i < 12; i++) {
    const h = randomHandle(rnd);
    if (!(await nameTaken(deps, h))) return h;
  }
  // Pairs are crowded: keep one pair and count up its numeric suffix, which cannot repeat.
  const base = randomHandle(rnd);
  for (let n = 10; n < 10_000; n++) {
    const h = `${base}-${n}`;
    if (!(await nameTaken(deps, h))) return h;
  }
  throw new ForumError('conflict', 'Could not allocate a handle');
}

async function profileRow(deps: Pick<Deps, 'db'>, sub: string): Promise<ForumProfile | undefined> {
  const [p] = await deps.db.select().from(forumProfiles).where(eq(forumProfiles.auth0Sub, sub)).limit(1);
  return p;
}

/**
 * The viewer's forum profile, created on first use with a username taken from their email and a
 * fresh random handle. Also keeps the admin-only email current. Safe to call on every request.
 */
export async function ensureProfile(deps: Deps, viewer: Pick<Viewer, 'sub' | 'email'>): Promise<ForumProfile> {
  const email = viewer.email.trim().toLowerCase();
  const existing = await profileRow(deps, viewer.sub);
  if (existing) {
    if (existing.email !== email) await deps.db.update(forumProfiles).set({ email }).where(eq(forumProfiles.auth0Sub, viewer.sub));
    return { ...existing, email };
  }
  const rnd = randomOf(deps);
  for (let attempt = 0; attempt < 20; attempt++) {
    let username = usernameFromEmail(email);
    if (attempt > 0) username = `${username.slice(0, 18)}${10 + Math.floor(rnd() * 90)}`;
    if (await nameTaken(deps, username)) continue;
    const handle = await generateUniqueHandle(deps);
    try {
      const [created] = await deps.db.insert(forumProfiles).values({ auth0Sub: viewer.sub, email, username, handle, createdAt: nowOf(deps) }).returning();
      return created;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const raced = await profileRow(deps, viewer.sub); // a concurrent request created it
      if (raced) return raced;
    }
  }
  throw new ForumError('conflict', 'Could not allocate a forum name');
}

export const getOwnProfile = async (deps: Deps, viewer: Pick<Viewer, 'sub' | 'email'>): Promise<OwnProfile> => ownProfile(await ensureProfile(deps, viewer));

const ProfileUpdate = z.object({
  displayMode: z.enum(['username', 'handle']).optional(),
  username: z.string().trim().toLowerCase().optional(),
});

/** Change the display mode and/or username. Changing the username also confirms it. Earlier posts keep the name they were made under. */
export async function updateOwnProfile(deps: Deps, viewer: Pick<Viewer, 'sub' | 'email'>, input: unknown): Promise<OwnProfile> {
  const patch = parse(ProfileUpdate, input);
  const profile = await ensureProfile(deps, viewer);
  const set: Partial<typeof forumProfiles.$inferInsert> = {};
  if (patch.displayMode) set.displayMode = patch.displayMode;
  if (patch.username !== undefined) {
    if (!isValidUsername(patch.username)) throw new ForumError('invalid', 'Usernames are 3 to 24 letters, numbers, - or _, and cannot be reserved or look like a random handle');
    if (patch.username !== profile.username && (await nameTaken(deps, patch.username, viewer.sub))) throw new ForumError('conflict', 'That username is taken');
    set.username = patch.username;
  }
  if (patch.username !== undefined || patch.displayMode) set.usernameConfirmedAt = profile.usernameConfirmedAt ?? nowOf(deps);
  if (Object.keys(set).length === 0) return ownProfile(profile);
  try {
    const [updated] = await deps.db.update(forumProfiles).set(set).where(eq(forumProfiles.auth0Sub, viewer.sub)).returning();
    return ownProfile(updated);
  } catch (e) {
    if (isUniqueViolation(e)) throw new ForumError('conflict', 'That username is taken');
    throw e;
  }
}

/** Where a mention can point: the name a member currently posts under. */
const mentionName = sql<string>`case when ${forumProfiles.displayMode} = 'handle' then ${forumProfiles.handle} else ${forumProfiles.username} end`;

export type Mentionable = { name: string; mode: DisplayMode };

/**
 * Members whose current display name starts with `prefix` (a leading `@` is ignored), for the
 * @mention picker. Only the name a member currently posts under is searchable, so a handle is
 * never linked to its owner's username.
 */
export async function searchMentionable(deps: Deps, prefix: string, limit = 8): Promise<Mentionable[]> {
  const p = prefix.replace(/^@/, '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{0,32}$/.test(p)) return [];
  const rows = await deps.db
    .select({ name: mentionName, mode: forumProfiles.displayMode })
    .from(forumProfiles)
    .where(sql`${mentionName} like ${escapeLike(p) + '%'} escape '\\'`)
    .orderBy(mentionName)
    .limit(Math.min(Math.max(limit, 1), 20));
  return rows;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Resolve lowercase names to the members they currently name. */
async function resolveMentions(deps: Pick<Deps, 'db'>, names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (names.length === 0) return out;
  const rows = await deps.db
    .select({ name: mentionName, sub: forumProfiles.auth0Sub })
    .from(forumProfiles)
    .where(inArray(mentionName, names));
  for (const r of rows) out.set(r.name, r.sub);
  return out;
}

// ---------------------------------------------------------------- authors

/** An author as shown on a thread or post. `account` is present for admins only. */
export type AuthorView = {
  name: string;
  mode: DisplayMode;
  /** Posted by an admin under their username; shown as a staff badge. */
  isStaff: boolean;
  /** The viewer wrote this. Lets the UI offer author-only actions without exposing anyone's account. */
  mine: boolean;
  /** The real account behind the name. Only ever set when the viewer is an admin. */
  account?: { sub: string; email: string };
};

function authorOf(row: { authorSub: string; authorName: string; authorMode: DisplayMode; authorIsStaff: boolean }, emailBySub: Map<string, string>, viewer: Viewer): AuthorView {
  const a: AuthorView = { name: row.authorName, mode: row.authorMode, isStaff: row.authorIsStaff, mine: row.authorSub === viewer.sub };
  if (viewer.isAdmin) a.account = { sub: row.authorSub, email: emailBySub.get(row.authorSub) ?? '' };
  return a;
}

async function emailsFor(deps: Pick<Deps, 'db'>, viewer: Viewer, subs: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!viewer.isAdmin || subs.length === 0) return map;
  const rows = await deps.db.select({ sub: forumProfiles.auth0Sub, email: forumProfiles.email }).from(forumProfiles).where(inArray(forumProfiles.auth0Sub, [...new Set(subs)]));
  for (const r of rows) map.set(r.sub, r.email);
  return map;
}

/** Admin only: the account(s) behind a display name (username or handle). Throws `forbidden` for anyone else. */
export async function findAccountByName(deps: Deps, viewer: Viewer, name: string): Promise<{ sub: string; email: string; username: string; handle: string } | null> {
  if (!viewer.isAdmin) throw new ForumError('forbidden', 'Admins only');
  const n = name.replace(/^@/, '').trim().toLowerCase();
  const [p] = await deps.db.select().from(forumProfiles).where(or(eq(forumProfiles.username, n), eq(forumProfiles.handle, n))).limit(1);
  return p ? { sub: p.auth0Sub, email: p.email, username: p.username, handle: p.handle } : null;
}

// ---------------------------------------------------------------- bodies

export const BodyInput = z.object({
  format: z.enum(['rich', 'markdown']),
  /** Sanitized server-side. For `rich`, HTML from the editor. For `markdown`, the Markdown source. */
  body: z.string().max(MAX_BODY_CHARS * 2, 'Too long'),
});
export type BodyInput = z.infer<typeof BodyInput>;

type PreparedBody = { html: string; format: BodyInput['format']; source: string | null; mentionNames: string[] };

function prepareBody(input: BodyInput): PreparedBody {
  const html = input.format === 'markdown' ? markdownToHtml(input.body) : sanitizeBody(input.body);
  const text = plainText(html);
  if (text.length === 0) throw new ForumError('invalid', 'Write something first');
  if (text.length > MAX_BODY_CHARS) throw new ForumError('invalid', `Keep it under ${MAX_BODY_CHARS} characters`);
  return { html, format: input.format, source: input.format === 'markdown' ? input.body : null, mentionNames: extractMentionNames(text) };
}

async function finishBody(deps: Pick<Deps, 'db'>, prepared: PreparedBody): Promise<{ html: string; subs: string[] }> {
  const resolved = await resolveMentions(deps, prepared.mentionNames);
  return { html: wrapMentions(prepared.html, new Set(resolved.keys())), subs: [...new Set(resolved.values())] };
}

const TagList = z
  .array(z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{0,23}$/, 'Tags are lowercase letters, numbers and -'))
  .max(3, 'Up to 3 tags')
  .default([])
  .transform((t) => [...new Set(t)]);

const NewThread = z.object({
  kind: z.enum(THREAD_KINDS).default('discussion'),
  categorySlug: z.string().min(1),
  title: z.string().trim().min(3, 'Title is too short').max(140, 'Title is too long'),
  tags: TagList,
  body: BodyInput,
});
export type NewThreadInput = z.input<typeof NewThread>;

const NewReply = z.object({ body: BodyInput, quotePostId: z.string().uuid().optional() });
export type NewReplyInput = z.input<typeof NewReply>;

async function authorSnapshot(deps: Deps, viewer: Viewer) {
  const p = await ensureProfile(deps, viewer);
  const mode = p.displayMode;
  return { authorSub: viewer.sub, authorName: displayNameOf(p), authorMode: mode, authorIsStaff: viewer.isAdmin && mode === 'username' };
}

// ---------------------------------------------------------------- threads

export type ThreadSummary = {
  id: string;
  title: string;
  category: { slug: string; name: string; group: ForumGroup };
  author: AuthorView;
  tags: string[];
  pinned: boolean;
  locked: boolean;
  answered: boolean;
  replyCount: number;
  kind: ThreadKind;
  /** Bug reports and feature requests only; null for discussions. */
  status: ReportStatus | null;
  /** "Me too" votes on a report. 0 for discussions. */
  voteCount: number;
  /** The viewer has voted on this report. */
  voted: boolean;
  createdAt: Date;
  lastActivityAt: Date;
  /** First 200 characters of the opening post as plain text. */
  excerpt: string;
  bookmarked: boolean;
  /** Activity since the viewer last opened the thread (or never opened, and not their own). Drives the "new" marker. */
  hasNew: boolean;
  /** Admin only: total views. Absent for everyone else. */
  views?: number;
};

export type ThreadSort = 'latest' | 'new' | 'top' | 'unanswered' | 'votes';
/** `active` = open, acknowledged, planned or in progress; `closed` = done, declined or duplicate. */
export type StatusFilter = 'active' | 'closed';
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

const ListOptions = z.object({
  categorySlug: z.string().optional(),
  /** One kind, or `report` for bugs and features together. */
  kind: z.enum([...THREAD_KINDS, 'report']).optional(),
  status: z.enum(['active', 'closed']).optional(),
  sort: z.enum(['latest', 'new', 'top', 'unanswered', 'votes']).default('latest'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});
export type ListThreadsOptions = z.input<typeof ListOptions>;

const threadCols = {
  thread: forumThreads,
  categorySlug: forumCategories.slug,
  categoryName: forumCategories.name,
  categoryGroup: forumCategories.group,
};

async function summaries(
  deps: Deps,
  viewer: Viewer,
  rows: { thread: ForumThread; categorySlug: string; categoryName: string; categoryGroup: ForumGroup }[],
): Promise<ThreadSummary[]> {
  const ids = rows.map((r) => r.thread.id);
  const reportIds = rows.filter((r) => isReportKind(r.thread.kind)).map((r) => r.thread.id);
  const [emails, marks, views, seen, votes] = await Promise.all([
    emailsFor(deps, viewer, rows.map((r) => r.thread.authorSub)),
    ids.length ? deps.db.select({ id: forumBookmarks.threadId }).from(forumBookmarks).where(and(eq(forumBookmarks.auth0Sub, viewer.sub), inArray(forumBookmarks.threadId, ids))) : [],
    viewer.isAdmin && ids.length ? viewCountsFor(deps, ids) : new Map<string, number>(),
    ids.length
      ? deps.db.select({ id: forumThreadViews.threadId, at: forumThreadViews.lastViewedAt }).from(forumThreadViews).where(and(eq(forumThreadViews.auth0Sub, viewer.sub), inArray(forumThreadViews.threadId, ids)))
      : [],
    reportIds.length ? deps.db.select({ id: forumVotes.threadId }).from(forumVotes).where(and(eq(forumVotes.auth0Sub, viewer.sub), inArray(forumVotes.threadId, reportIds))) : [],
  ]);
  const voted = new Set(votes.map((v) => v.id));
  const marked = new Set(marks.map((m) => m.id));
  const lastSeen = new Map(seen.map((v) => [v.id, v.at]));
  return rows.map(({ thread: t, categorySlug, categoryName, categoryGroup }) => ({
    id: t.id,
    title: t.title,
    category: { slug: categorySlug, name: categoryName, group: categoryGroup },
    author: authorOf(t, emails, viewer),
    tags: t.tags,
    pinned: t.pinned,
    locked: t.locked,
    answered: t.solutionPostId !== null,
    replyCount: t.replyCount,
    kind: t.kind,
    status: isReportKind(t.kind) ? (t.status ?? 'open') : null,
    voteCount: isReportKind(t.kind) ? t.voteCount : 0,
    voted: voted.has(t.id),
    createdAt: t.createdAt,
    lastActivityAt: t.lastActivityAt,
    excerpt: plainText(t.bodyHtml).slice(0, 200),
    bookmarked: marked.has(t.id),
    hasNew: lastSeen.has(t.id) ? t.lastActivityAt.getTime() > (lastSeen.get(t.id) as Date).getTime() : t.authorSub !== viewer.sub,
    ...(viewer.isAdmin ? { views: views.get(t.id) ?? 0 } : {}),
  }));
}

/**
 * Threads, newest activity first by default. Pinned threads come first in `latest`.
 * `top` orders by replies, `votes` by "me too" votes, `unanswered` lists threads with no replies.
 * Omit `categorySlug` for all boards. `kind` and `status` narrow to bug reports and feature requests.
 */
export async function listThreads(deps: Deps, viewer: Viewer, options: ListThreadsOptions = {}): Promise<Page<ThreadSummary>> {
  const o = parse(ListOptions, options);
  const where = [] as ReturnType<typeof eq>[];
  if (o.categorySlug) where.push(eq(forumCategories.slug, o.categorySlug));
  if (o.sort === 'unanswered') where.push(eq(forumThreads.replyCount, 0));
  if (o.kind === 'report') where.push(inArray(forumThreads.kind, ['bug', 'feature']));
  else if (o.kind) where.push(eq(forumThreads.kind, o.kind));
  if (o.status === 'active') where.push(inArray(forumThreads.status, [...ACTIVE_STATUSES]));
  if (o.status === 'closed') where.push(inArray(forumThreads.status, REPORT_STATUSES.filter((st) => !ACTIVE_STATUSES.includes(st))));
  const cond = where.length ? and(...where) : undefined;
  const order =
    o.sort === 'top'
      ? [desc(forumThreads.replyCount), desc(forumThreads.lastActivityAt)]
      : o.sort === 'votes'
        ? [desc(forumThreads.voteCount), desc(forumThreads.lastActivityAt)]
      : o.sort === 'new' || o.sort === 'unanswered'
        ? [desc(forumThreads.createdAt)]
        : [desc(forumThreads.pinned), desc(forumThreads.lastActivityAt)];
  const [rows, [{ n }]] = await Promise.all([
    deps.db
      .select(threadCols)
      .from(forumThreads)
      .innerJoin(forumCategories, eq(forumCategories.id, forumThreads.categoryId))
      .where(cond)
      .orderBy(...order)
      .limit(o.pageSize)
      .offset((o.page - 1) * o.pageSize),
    deps.db
      .select({ n: sql<number>`count(*)::int` })
      .from(forumThreads)
      .innerJoin(forumCategories, eq(forumCategories.id, forumThreads.categoryId))
      .where(cond),
  ]);
  return { items: await summaries(deps, viewer, rows), total: n, page: o.page, pageSize: o.pageSize };
}

export type ReactionSummary = { emoji: string; count: number; mine: boolean };
export type PostView = {
  id: string;
  author: AuthorView;
  bodyHtml: string;
  bodyFormat: 'rich' | 'markdown';
  quotePostId: string | null;
  isSolution: boolean;
  createdAt: Date;
  reactions: ReactionSummary[];
};
export type ThreadDetail = Omit<ThreadSummary, 'excerpt'> & {
  bodyHtml: string;
  bodyFormat: 'rich' | 'markdown';
  /** Reactions on the opening post. */
  reactions: ReactionSummary[];
  posts: PostView[];
  /** When the viewer last opened this thread (before this visit), or null. Lets the UI mark new replies. */
  viewerLastViewedAt: Date | null;
  /** Admin only: distinct viewers. Absent for everyone else. */
  viewers?: number;
  /** Status changes on a report, oldest first. Empty for discussions. */
  statusEvents: StatusEvent[];
  /** The report this one duplicates, when its status is `duplicate`. */
  duplicateOf: { id: string; title: string } | null;
};

export type StatusEvent = { id: string; from: ReportStatus | null; to: ReportStatus; actorName: string; note: string | null; createdAt: Date };

export const REACTION_EMOJI = ['👍', '👀', '🙏', '❤️', '😄'] as const;

/** One thread with its opening post, replies (oldest first), reactions and bookmark state. Does not record a view. */
export async function getThread(deps: Deps, viewer: Viewer, threadId: string): Promise<ThreadDetail | null> {
  if (!z.string().uuid().safeParse(threadId).success) return null;
  const [row] = await deps.db
    .select(threadCols)
    .from(forumThreads)
    .innerJoin(forumCategories, eq(forumCategories.id, forumThreads.categoryId))
    .where(eq(forumThreads.id, threadId))
    .limit(1);
  if (!row) return null;
  const [posts, reacts, [mineView], events, [dup]] = await Promise.all([
    deps.db.select().from(forumPosts).where(eq(forumPosts.threadId, threadId)).orderBy(asc(forumPosts.createdAt), asc(forumPosts.id)),
    deps.db.select().from(forumReactions).where(eq(forumReactions.threadId, threadId)),
    deps.db.select({ at: forumThreadViews.lastViewedAt }).from(forumThreadViews).where(and(eq(forumThreadViews.threadId, threadId), eq(forumThreadViews.auth0Sub, viewer.sub))).limit(1),
    deps.db.select().from(forumStatusEvents).where(eq(forumStatusEvents.threadId, threadId)).orderBy(asc(forumStatusEvents.createdAt), asc(forumStatusEvents.id)),
    row.thread.duplicateOfId
      ? deps.db.select({ id: forumThreads.id, title: forumThreads.title }).from(forumThreads).where(eq(forumThreads.id, row.thread.duplicateOfId)).limit(1)
      : [],
  ]);
  const [summary] = await summaries(deps, viewer, [row]);
  const emails = await emailsFor(deps, viewer, posts.map((p) => p.authorSub));
  const reactionsFor = (targetId: string): ReactionSummary[] => {
    const by = new Map<string, ReactionSummary>();
    for (const r of reacts.filter((x) => x.targetId === targetId)) {
      const s = by.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
      s.count++;
      if (r.auth0Sub === viewer.sub) s.mine = true;
      by.set(r.emoji, s);
    }
    return [...by.values()];
  };
  const { excerpt: _excerpt, ...rest } = summary;
  void _excerpt;
  const detail: ThreadDetail = {
    ...rest,
    bodyHtml: row.thread.bodyHtml,
    bodyFormat: row.thread.bodyFormat,
    reactions: reactionsFor(row.thread.id),
    viewerLastViewedAt: mineView?.at ?? null,
    statusEvents: events.map((e) => ({ id: e.id, from: e.fromStatus, to: e.toStatus, actorName: e.actorName, note: e.note, createdAt: e.createdAt })),
    duplicateOf: row.thread.status === 'duplicate' && dup ? dup : null,
    posts: posts.map((p: ForumPost) => ({
      id: p.id,
      author: authorOf(p, emails, viewer),
      bodyHtml: p.bodyHtml,
      bodyFormat: p.bodyFormat,
      quotePostId: p.quotePostId,
      isSolution: row.thread.solutionPostId === p.id,
      createdAt: p.createdAt,
      reactions: reactionsFor(p.id),
    })),
  };
  if (viewer.isAdmin) {
    const [{ n }] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(forumThreadViews).where(eq(forumThreadViews.threadId, threadId));
    detail.viewers = n;
  }
  return detail;
}

/**
 * Start a thread: a discussion, a bug report or a feature request (`kind`). Reports start `open`.
 * Validates (title 3 to 140 chars, up to 3 tags, non-empty body), sanitizes the body,
 * snapshots how the author appears, and records @mentions of members. Returns the new thread id.
 */
export async function createThread(deps: Deps, viewer: Viewer, input: NewThreadInput): Promise<{ id: string }> {
  const v = parse(NewThread, input);
  const category = await categoryBySlug(deps, v.categorySlug);
  const prepared = prepareBody(v.body);
  const { html, subs } = await finishBody(deps, prepared);
  const author = await authorSnapshot(deps, viewer);
  const now = nowOf(deps);
  const [t] = await deps.db
    .insert(forumThreads)
    .values({
      categoryId: category.id,
      ...author,
      title: v.title,
      bodyHtml: html,
      bodyFormat: prepared.format,
      bodySource: prepared.source,
      tags: v.tags,
      kind: v.kind,
      status: isReportKind(v.kind) ? 'open' : null,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    })
    .returning({ id: forumThreads.id });
  if (subs.length) await deps.db.insert(forumMentions).values(subs.map((s) => ({ threadId: t.id, postId: null, mentionedSub: s, createdAt: now })));
  return { id: t.id };
}

/** Reply to a thread. Throws `locked` on a locked thread (admins may still reply) and `not_found` for a bad thread or quote. */
export async function createReply(deps: Deps, viewer: Viewer, threadId: string, input: NewReplyInput): Promise<{ id: string }> {
  const v = parse(NewReply, input);
  const [thread] = await deps.db.select().from(forumThreads).where(eq(forumThreads.id, z.string().uuid().safeParse(threadId).success ? threadId : '00000000-0000-0000-0000-000000000000')).limit(1);
  if (!thread) throw new ForumError('not_found', 'No such thread');
  if (thread.locked && !viewer.isAdmin) throw new ForumError('locked', 'This thread is locked');
  if (v.quotePostId) {
    const [q] = await deps.db.select({ id: forumPosts.id }).from(forumPosts).where(and(eq(forumPosts.id, v.quotePostId), eq(forumPosts.threadId, threadId))).limit(1);
    if (!q) throw new ForumError('not_found', 'The post you are quoting is not in this thread');
  }
  const prepared = prepareBody(v.body);
  const { html, subs } = await finishBody(deps, prepared);
  const author = await authorSnapshot(deps, viewer);
  const now = nowOf(deps);
  const [p] = await deps.db
    .insert(forumPosts)
    .values({ threadId, ...author, bodyHtml: html, bodyFormat: prepared.format, bodySource: prepared.source, quotePostId: v.quotePostId ?? null, createdAt: now })
    .returning({ id: forumPosts.id });
  if (subs.length) await deps.db.insert(forumMentions).values(subs.map((s) => ({ threadId, postId: p.id, mentionedSub: s, createdAt: now })));
  await deps.db
    .update(forumThreads)
    .set({ replyCount: sql`${forumThreads.replyCount} + 1`, lastActivityAt: now, updatedAt: now })
    .where(eq(forumThreads.id, threadId));
  return { id: p.id };
}

/** Mark (or clear, with `postId` null) the post that answers the thread. The thread's author or an admin only. */
export async function markSolution(deps: Deps, viewer: Viewer, threadId: string, postId: string | null): Promise<void> {
  if (!isUuid(threadId) || (postId !== null && !isUuid(postId))) throw new ForumError('not_found', 'No such thread');
  const [t] = await deps.db.select().from(forumThreads).where(eq(forumThreads.id, threadId)).limit(1);
  if (!t) throw new ForumError('not_found', 'No such thread');
  if (!viewer.isAdmin && t.authorSub !== viewer.sub) throw new ForumError('forbidden', 'Only the thread author can mark an answer');
  if (postId) {
    const [p] = await deps.db.select({ id: forumPosts.id }).from(forumPosts).where(and(eq(forumPosts.id, postId), eq(forumPosts.threadId, threadId))).limit(1);
    if (!p) throw new ForumError('not_found', 'No such post in this thread');
  }
  await deps.db.update(forumThreads).set({ solutionPostId: postId }).where(eq(forumThreads.id, threadId));
}

/** Add or remove the viewer's reaction on the opening post (targetId = thread id) or a reply (post id). Returns true when now set. */
export async function toggleReaction(deps: Deps, viewer: Viewer, threadId: string, targetId: string, emoji: string): Promise<boolean> {
  if (!(REACTION_EMOJI as readonly string[]).includes(emoji)) throw new ForumError('invalid', 'Unsupported reaction');
  if (!isUuid(threadId) || !isUuid(targetId)) throw new ForumError('not_found', 'No such post');
  if (targetId !== threadId) {
    const [p] = await deps.db.select({ id: forumPosts.id }).from(forumPosts).where(and(eq(forumPosts.id, targetId), eq(forumPosts.threadId, threadId))).limit(1);
    if (!p) throw new ForumError('not_found', 'No such post');
  } else {
    const [t] = await deps.db.select({ id: forumThreads.id }).from(forumThreads).where(eq(forumThreads.id, threadId)).limit(1);
    if (!t) throw new ForumError('not_found', 'No such thread');
  }
  const key = and(eq(forumReactions.targetId, targetId), eq(forumReactions.auth0Sub, viewer.sub), eq(forumReactions.emoji, emoji));
  const removed = await deps.db.delete(forumReactions).where(key).returning({ e: forumReactions.emoji });
  if (removed.length) return false;
  await deps.db.insert(forumReactions).values({ targetId, threadId, auth0Sub: viewer.sub, emoji, createdAt: nowOf(deps) }).onConflictDoNothing();
  return true;
}

// ---------------------------------------------------------------- bookmarks

/** Bookmark a thread, or remove the bookmark if it exists. Returns true when the thread is now bookmarked. */
export async function toggleBookmark(deps: Deps, viewer: Viewer, threadId: string): Promise<boolean> {
  const [t] = await deps.db.select({ id: forumThreads.id }).from(forumThreads).where(eq(forumThreads.id, z.string().uuid().safeParse(threadId).success ? threadId : '00000000-0000-0000-0000-000000000000')).limit(1);
  if (!t) throw new ForumError('not_found', 'No such thread');
  const removed = await deps.db
    .delete(forumBookmarks)
    .where(and(eq(forumBookmarks.auth0Sub, viewer.sub), eq(forumBookmarks.threadId, threadId)))
    .returning({ id: forumBookmarks.threadId });
  if (removed.length) return false;
  await deps.db.insert(forumBookmarks).values({ auth0Sub: viewer.sub, threadId, createdAt: nowOf(deps) }).onConflictDoNothing();
  return true;
}

/** The viewer's bookmarked threads, most recently bookmarked first. */
export async function listBookmarks(deps: Deps, viewer: Viewer, options: { page?: number; pageSize?: number } = {}): Promise<Page<ThreadSummary>> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(options.pageSize ?? 20)));
  const mine = eq(forumBookmarks.auth0Sub, viewer.sub);
  const [rows, [{ n }]] = await Promise.all([
    deps.db
      .select(threadCols)
      .from(forumBookmarks)
      .innerJoin(forumThreads, eq(forumThreads.id, forumBookmarks.threadId))
      .innerJoin(forumCategories, eq(forumCategories.id, forumThreads.categoryId))
      .where(mine)
      .orderBy(desc(forumBookmarks.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    deps.db.select({ n: sql<number>`count(*)::int` }).from(forumBookmarks).where(mine),
  ]);
  return { items: await summaries(deps, viewer, rows), total: n, page, pageSize };
}

// ---------------------------------------------------------------- votes

/**
 * Add or remove the viewer's "me too" vote on a bug report or feature request. Returns true when now
 * set. The author's own report already counts them, so they cannot vote on it. Duplicates take no
 * votes: vote on the original instead.
 */
export async function toggleVote(deps: Deps, viewer: Viewer, threadId: string): Promise<boolean> {
  if (!isUuid(threadId)) throw new ForumError('not_found', 'No such thread');
  const [t] = await deps.db.select({ kind: forumThreads.kind, status: forumThreads.status, authorSub: forumThreads.authorSub }).from(forumThreads).where(eq(forumThreads.id, threadId)).limit(1);
  if (!t) throw new ForumError('not_found', 'No such thread');
  if (!isReportKind(t.kind)) throw new ForumError('invalid', 'Only bug reports and feature requests take votes');
  if (t.authorSub === viewer.sub) throw new ForumError('forbidden', 'You opened this one, so it already counts you');
  const key = and(eq(forumVotes.threadId, threadId), eq(forumVotes.auth0Sub, viewer.sub));
  const removed = await deps.db.delete(forumVotes).where(key).returning({ id: forumVotes.threadId });
  if (removed.length) {
    await deps.db.update(forumThreads).set({ voteCount: sql`greatest(${forumThreads.voteCount} - 1, 0)` }).where(eq(forumThreads.id, threadId));
    return false;
  }
  if (t.status === 'duplicate') throw new ForumError('invalid', 'This is a duplicate. Vote on the original report.');
  const added = await deps.db.insert(forumVotes).values({ threadId, auth0Sub: viewer.sub, createdAt: nowOf(deps) }).onConflictDoNothing().returning({ id: forumVotes.threadId });
  if (added.length) await deps.db.update(forumThreads).set({ voteCount: sql`${forumThreads.voteCount} + 1` }).where(eq(forumThreads.id, threadId));
  return true;
}

// ---------------------------------------------------------------- views (admin-only)

/**
 * Count a view of a thread by the viewer. One member opening a thread several times inside an hour
 * counts once. Call it from the thread page after getThread.
 */
export async function recordView(deps: Deps, viewer: Viewer, threadId: string): Promise<void> {
  if (!z.string().uuid().safeParse(threadId).success) return;
  const now = nowOf(deps);
  const [t] = await deps.db.select({ id: forumThreads.id }).from(forumThreads).where(eq(forumThreads.id, threadId)).limit(1);
  if (!t) return;
  const bumped = await deps.db
    .update(forumThreadViews)
    .set({ count: sql`${forumThreadViews.count} + 1`, lastViewedAt: now })
    .where(and(eq(forumThreadViews.threadId, threadId), eq(forumThreadViews.auth0Sub, viewer.sub), lte(forumThreadViews.lastViewedAt, new Date(now.getTime() - HOUR_MS))))
    .returning({ c: forumThreadViews.count });
  if (bumped.length) return;
  await deps.db.insert(forumThreadViews).values({ threadId, auth0Sub: viewer.sub, count: 1, firstViewedAt: now, lastViewedAt: now }).onConflictDoNothing();
}

async function viewCountsFor(deps: Pick<Deps, 'db'>, ids: string[]): Promise<Map<string, number>> {
  const rows = await deps.db
    .select({ id: forumThreadViews.threadId, n: sql<number>`coalesce(sum(${forumThreadViews.count}), 0)::int` })
    .from(forumThreadViews)
    .where(inArray(forumThreadViews.threadId, ids))
    .groupBy(forumThreadViews.threadId);
  return new Map(rows.map((r) => [r.id, r.n]));
}

/** Admin only: total views per thread id (0 when none). Throws `forbidden` for anyone else. */
export async function getViewCounts(deps: Deps, viewer: Viewer, threadIds: string[]): Promise<Record<string, number>> {
  if (!viewer.isAdmin) throw new ForumError('forbidden', 'Admins only');
  const ids = threadIds.filter((i) => z.string().uuid().safeParse(i).success);
  const counts = ids.length ? await viewCountsFor(deps, ids) : new Map<string, number>();
  return Object.fromEntries(threadIds.map((id) => [id, counts.get(id) ?? 0]));
}

// ---------------------------------------------------------------- search

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'how', 'why', 'what', 'when', 'can', 'does', 'not', 'are', 'but', 'you', 'this', 'that', 'from', 'have', 'has', 'into', 'about', 'any', 'get', 'out', 'use']);

export type SimilarThread = {
  id: string;
  title: string;
  categoryName: string;
  categorySlug: string;
  replyCount: number;
  answered: boolean;
  kind: ThreadKind;
  status: ReportStatus | null;
};

/**
 * Existing threads whose titles share words with `title`, best match first. Plain ILIKE on up to 6
 * significant words (no extensions), so it works on Neon and PGlite alike. Returns [] for a short title.
 */
export async function findSimilarThreads(deps: Deps, title: string, options: { limit?: number; categorySlug?: string } = {}): Promise<SimilarThread[]> {
  const words = [...new Set(title.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])].filter((w) => !STOP_WORDS.has(w)).slice(0, 6);
  if (words.length === 0) return [];
  const hits = words.map((w) => sql`(case when ${forumThreads.title} ilike ${'%' + escapeLike(w) + '%'} then 1 else 0 end)`);
  const score = sql<number>`(${sql.join(hits, sql` + `)})`;
  const cond = [or(...words.map((w) => ilike(forumThreads.title, `%${escapeLike(w)}%`)))];
  if (options.categorySlug) cond.push(eq(forumCategories.slug, options.categorySlug));
  const rows = await deps.db
    .select({
      id: forumThreads.id,
      title: forumThreads.title,
      categoryName: forumCategories.name,
      categorySlug: forumCategories.slug,
      replyCount: forumThreads.replyCount,
      solution: forumThreads.solutionPostId,
      kind: forumThreads.kind,
      status: forumThreads.status,
    })
    .from(forumThreads)
    .innerJoin(forumCategories, eq(forumCategories.id, forumThreads.categoryId))
    .where(and(...cond))
    .orderBy(desc(score), desc(forumThreads.lastActivityAt))
    .limit(Math.min(Math.max(options.limit ?? 5, 1), 10));
  return rows.map(({ solution, ...r }) => ({ ...r, answered: solution !== null }));
}

// ---------------------------------------------------------------- moderation (admin only)

function requireAdmin(viewer: Viewer) {
  if (!viewer.isAdmin) throw new ForumError('forbidden', 'Admins only');
}

async function updateThreadFlag(deps: Deps, viewer: Viewer, threadId: string, set: Partial<typeof forumThreads.$inferInsert>) {
  requireAdmin(viewer);
  if (!z.string().uuid().safeParse(threadId).success) throw new ForumError('not_found', 'No such thread');
  const rows = await deps.db.update(forumThreads).set(set).where(eq(forumThreads.id, threadId)).returning({ id: forumThreads.id });
  if (!rows.length) throw new ForumError('not_found', 'No such thread');
}

/** Admin only: pin or unpin a thread. */
export const setPinned = (deps: Deps, viewer: Viewer, threadId: string, pinned: boolean) => updateThreadFlag(deps, viewer, threadId, { pinned });
/** Admin only: lock or unlock a thread. Members cannot reply to a locked thread. */
export const setLocked = (deps: Deps, viewer: Viewer, threadId: string, locked: boolean) => updateThreadFlag(deps, viewer, threadId, { locked });

const StatusChange = z.object({
  status: z.enum(REPORT_STATUSES),
  note: z.string().trim().max(500, 'Keep the note under 500 characters').optional(),
  duplicateOfId: z.string().uuid().optional(),
});
export type StatusChangeInput = z.input<typeof StatusChange>;

/**
 * Admin only: move a bug report or feature request to a new status, with an optional note shown on
 * its timeline. `duplicate` needs `duplicateOfId`, another report. Counts as activity on the thread.
 */
export async function setThreadStatus(deps: Deps, viewer: Viewer, threadId: string, input: StatusChangeInput): Promise<void> {
  requireAdmin(viewer);
  const v = parse(StatusChange, input);
  if (!isUuid(threadId)) throw new ForumError('not_found', 'No such thread');
  const [t] = await deps.db
    .select({ kind: forumThreads.kind, status: forumThreads.status, duplicateOfId: forumThreads.duplicateOfId })
    .from(forumThreads)
    .where(eq(forumThreads.id, threadId))
    .limit(1);
  if (!t) throw new ForumError('not_found', 'No such thread');
  if (!isReportKind(t.kind)) throw new ForumError('invalid', 'Only bug reports and feature requests have a status');
  let duplicateOfId: string | null = null;
  if (v.status === 'duplicate') {
    if (!v.duplicateOfId) throw new ForumError('invalid', 'Choose the report this duplicates');
    if (v.duplicateOfId === threadId) throw new ForumError('invalid', 'A report cannot duplicate itself');
    const [orig] = await deps.db.select({ kind: forumThreads.kind, status: forumThreads.status }).from(forumThreads).where(eq(forumThreads.id, v.duplicateOfId)).limit(1);
    if (!orig || !isReportKind(orig.kind)) throw new ForumError('not_found', 'No such report to point to');
    // Point at the original, never at another duplicate, so there are no chains or loops.
    if (orig.status === 'duplicate') throw new ForumError('invalid', 'That report is itself a duplicate. Link to its original');
    duplicateOfId = v.duplicateOfId;
  }
  const from = t.status ?? 'open';
  if (from === v.status && !v.note && (t.duplicateOfId ?? null) === duplicateOfId) return;
  const actor = await authorSnapshot(deps, viewer);
  const now = nowOf(deps);
  await deps.db.update(forumThreads).set({ status: v.status, duplicateOfId, lastActivityAt: now, updatedAt: now }).where(eq(forumThreads.id, threadId));
  await deps.db.insert(forumStatusEvents).values({ threadId, fromStatus: from, toStatus: v.status, actorSub: viewer.sub, actorName: actor.authorName, note: v.note || null, createdAt: now });
}

/**
 * Admin only: reclassify a thread (a discussion that is really a bug, say). Becoming a report starts
 * it `open`; becoming a discussion clears its status. Votes and the timeline are kept.
 */
export async function setThreadKind(deps: Deps, viewer: Viewer, threadId: string, kind: ThreadKind): Promise<void> {
  requireAdmin(viewer);
  if (!(THREAD_KINDS as readonly string[]).includes(kind)) throw new ForumError('invalid', 'Unknown kind');
  if (!isUuid(threadId)) throw new ForumError('not_found', 'No such thread');
  const [t] = await deps.db.select({ status: forumThreads.status }).from(forumThreads).where(eq(forumThreads.id, threadId)).limit(1);
  if (!t) throw new ForumError('not_found', 'No such thread');
  const status = isReportKind(kind) ? (t.status ?? 'open') : null;
  await deps.db.update(forumThreads).set({ kind, status, duplicateOfId: status === 'duplicate' ? undefined : null }).where(eq(forumThreads.id, threadId));
}

/** Admin only: delete a thread and everything under it (replies, reactions, bookmarks, views, mentions). */
export async function deleteThread(deps: Deps, viewer: Viewer, threadId: string): Promise<void> {
  requireAdmin(viewer);
  if (!z.string().uuid().safeParse(threadId).success) throw new ForumError('not_found', 'No such thread');
  const rows = await deps.db.delete(forumThreads).where(eq(forumThreads.id, threadId)).returning({ id: forumThreads.id });
  if (!rows.length) throw new ForumError('not_found', 'No such thread');
}

/** Admin only: delete one reply. Fixes the reply count and clears it as the solution if it was one. */
export async function deletePost(deps: Deps, viewer: Viewer, postId: string): Promise<void> {
  requireAdmin(viewer);
  if (!z.string().uuid().safeParse(postId).success) throw new ForumError('not_found', 'No such post');
  const rows = await deps.db.delete(forumPosts).where(eq(forumPosts.id, postId)).returning({ threadId: forumPosts.threadId });
  if (!rows.length) throw new ForumError('not_found', 'No such post');
  const threadId = rows[0].threadId;
  await deps.db.delete(forumReactions).where(eq(forumReactions.targetId, postId));
  await deps.db.update(forumPosts).set({ quotePostId: null }).where(eq(forumPosts.quotePostId, postId));
  await deps.db
    .update(forumThreads)
    .set({ replyCount: sql`greatest(${forumThreads.replyCount} - 1, 0)`, solutionPostId: sql`case when ${forumThreads.solutionPostId} = ${postId} then null else ${forumThreads.solutionPostId} end` })
    .where(eq(forumThreads.id, threadId));
}

export type { DisplayMode, ForumGroup, ReportStatus, ThreadKind };
