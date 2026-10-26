// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { forumMentions, forumProfiles } from '@/lib/forum/db/schema';
import * as svc from '@/lib/forum/service';
import { ForumError, type Db, type Deps } from '@/lib/forum/service';
import { HANDLE_PATTERN } from '@/lib/forum/names';
import { admin, makeDeps, md, member, newDb, rich } from './helpers';

let db: Db;
let deps: Deps;
let clock: Date;
const tick = (ms = 60_000) => (clock = new Date(clock.getTime() + ms));

beforeEach(async () => {
  db = await newDb();
  clock = new Date('2026-06-01T12:00:00Z');
  deps = makeDeps(db, { now: () => clock });
});

const alice = member('alice');
const bob = member('bob');
const post = (viewer = alice, over: Partial<svc.NewThreadInput> = {}) =>
  svc.createThread(deps, viewer, { categorySlug: 'aletheia', title: 'Import fails on large files', body: rich('<p>It stops at parsing.</p>'), ...over });
const expectCode = async (p: Promise<unknown>, code: svc.ErrorCode) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ForumError);
  expect((err as ForumError).code).toBe(code);
};

describe('categories', () => {
  it('seeds Aletheia and syncs other projects from the registry, grouped and counted', async () => {
    const t = await post();
    const cats = await svc.listCategories(deps);
    expect(cats.map((c) => [c.slug, c.group, c.threadCount])).toEqual([
      ['aletheia', 'aletheia', 1],
      ['groundwork', 'projects', 0],
      ['minima', 'projects', 0],
    ]);
    expect(t.id).toBeTruthy();
  });
  it('is idempotent and invents nothing', async () => {
    await svc.listCategories(deps);
    await svc.listCategories(deps);
    expect(await svc.listCategories(deps)).toHaveLength(3);
  });
  it('rejects a thread in an unknown category', async () => {
    await expectCode(post(alice, { categorySlug: 'nope' }), 'not_found');
  });
});

describe('profiles and handles', () => {
  it('creates a profile on first use with a username from the email and a random handle', async () => {
    const p = await svc.getOwnProfile(deps, alice);
    expect(p).toMatchObject({ username: 'alice', displayMode: 'username', usernameConfirmed: false, displayName: 'alice' });
    expect(p.handle).toMatch(HANDLE_PATTERN);
    expect((await svc.getOwnProfile(deps, alice)).handle).toBe(p.handle);
  });
  it('gives every member a unique handle even when the generator keeps colliding', async () => {
    // A generator that always returns the same word pair forces collision retries, then the numeric fallback.
    const constant = { ...deps, random: () => 0 };
    const handles = new Set<string>();
    for (let i = 0; i < 6; i++) handles.add((await svc.ensureProfile(constant, member(`m${i}`))).handle);
    expect(handles.size).toBe(6);
    for (const h of handles) expect(h).toMatch(HANDLE_PATTERN);
  });
  it('gives members with the same email prefix distinct usernames', async () => {
    const a = await svc.ensureProfile(deps, { sub: 'auth0|1', email: 'sam@one.com' });
    const b = await svc.ensureProfile(deps, { sub: 'auth0|2', email: 'sam@two.com' });
    expect(a.username).toBe('sam');
    expect(b.username).not.toBe('sam');
  });
  it('handles two concurrent first visits by one member', async () => {
    const [a, b] = await Promise.all([svc.ensureProfile(deps, alice), svc.ensureProfile(deps, alice)]);
    expect(a.auth0Sub).toBe(b.auth0Sub);
    expect(await db.select().from(forumProfiles)).toHaveLength(1);
  });
  it('switches display mode and renames, rejecting taken, reserved and handle-like names', async () => {
    await svc.getOwnProfile(deps, bob);
    const handle = (await svc.getOwnProfile(deps, alice)).handle;
    expect(await svc.updateOwnProfile(deps, alice, { displayMode: 'handle' })).toMatchObject({ displayMode: 'handle', displayName: handle, usernameConfirmed: true });
    expect(await svc.updateOwnProfile(deps, alice, { username: 'Jsample' })).toMatchObject({ username: 'jsample' });
    await expectCode(svc.updateOwnProfile(deps, alice, { username: 'bob' }), 'conflict');
    await expectCode(svc.updateOwnProfile(deps, alice, { username: 'admin' }), 'invalid');
    await expectCode(svc.updateOwnProfile(deps, alice, { username: 'quiet-heron' }), 'invalid');
    await expectCode(svc.updateOwnProfile(deps, alice, { displayMode: 'nickname' }), 'invalid');
  });
  it("does not let a username be another member's handle", async () => {
    const bobHandle = (await svc.getOwnProfile(deps, bob)).handle;
    await db.update(forumProfiles).set({ handle: 'wild-wren' }).where(eq(forumProfiles.handle, bobHandle));
    await expectCode(svc.updateOwnProfile(deps, alice, { username: 'wild-wren' }), 'invalid');
  });
});

describe('threads and replies', () => {
  it('validates input', async () => {
    await expectCode(post(alice, { title: 'hi' }), 'invalid');
    await expectCode(post(alice, { title: 'x'.repeat(141) }), 'invalid');
    await expectCode(post(alice, { body: rich('<script>x</script><p> </p>') }), 'invalid');
    await expectCode(post(alice, { tags: ['a', 'b', 'c', 'd'] }), 'invalid');
    await expectCode(post(alice, { tags: ['Not Valid!'] }), 'invalid');
    await expectCode(post(alice, { body: { format: 'html' as 'rich', body: 'x' } }), 'invalid');
  });
  it('sanitizes rich bodies on write and stores the Markdown source', async () => {
    const a = await post(alice, { body: rich('<p>ok</p><script>alert(1)</script><img src=x onerror=y>') });
    const b = await post(alice, { body: md('Hello **world** <script>x</script>') });
    const ta = await svc.getThread(deps, alice, a.id);
    const tb = await svc.getThread(deps, alice, b.id);
    expect(ta?.bodyHtml).toBe('<p>ok</p>');
    expect(ta?.bodyFormat).toBe('rich');
    expect(tb?.bodyHtml).toContain('<strong>world</strong>');
    expect(tb?.bodyHtml).not.toContain('script');
    expect(tb?.bodyFormat).toBe('markdown');
  });
  it('lowercases and de-duplicates tags', async () => {
    const t = await post(alice, { tags: ['Import', 'import', 'beta-2'] });
    expect((await svc.getThread(deps, alice, t.id))?.tags).toEqual(['import', 'beta-2']);
  });
  it('replies bump the count and last activity, and list oldest first', async () => {
    const t = await post();
    tick();
    const r1 = await svc.createReply(deps, bob, t.id, { body: rich('<p>first</p>') });
    tick();
    await svc.createReply(deps, alice, t.id, { body: md('second'), quotePostId: r1.id });
    const d = await svc.getThread(deps, alice, t.id);
    expect(d?.replyCount).toBe(2);
    expect(d?.lastActivityAt).toEqual(clock);
    expect(d?.posts.map((p) => p.bodyHtml)).toEqual(['<p>first</p>', '<p>second</p>\n']);
    expect(d?.posts[1].quotePostId).toBe(r1.id);
  });
  it('rejects replies to missing threads, bad quotes and locked threads', async () => {
    const t = await post();
    const other = await post();
    const foreign = await svc.createReply(deps, bob, other.id, { body: rich('<p>x</p>') });
    await expectCode(svc.createReply(deps, bob, 'not-a-uuid', { body: rich('<p>x</p>') }), 'not_found');
    await expectCode(svc.createReply(deps, bob, t.id, { body: rich('<p>x</p>'), quotePostId: foreign.id }), 'not_found');
    await svc.setLocked(deps, admin, t.id, true);
    await expectCode(svc.createReply(deps, bob, t.id, { body: rich('<p>x</p>') }), 'locked');
    await expect(svc.createReply(deps, admin, t.id, { body: rich('<p>staff note</p>') })).resolves.toBeTruthy();
  });
  it('lets the author or an admin mark a solution, nobody else', async () => {
    const t = await post();
    const r = await svc.createReply(deps, bob, t.id, { body: rich('<p>try this</p>') });
    await expectCode(svc.markSolution(deps, bob, t.id, r.id), 'forbidden');
    await svc.markSolution(deps, alice, t.id, r.id);
    const d = await svc.getThread(deps, bob, t.id);
    expect(d?.answered).toBe(true);
    expect(d?.posts[0].isSolution).toBe(true);
    await svc.markSolution(deps, admin, t.id, null);
    expect((await svc.getThread(deps, bob, t.id))?.answered).toBe(false);
  });
  it('returns null for unknown or malformed thread ids', async () => {
    expect(await svc.getThread(deps, alice, 'nope')).toBeNull();
    expect(await svc.getThread(deps, alice, crypto.randomUUID())).toBeNull();
  });
  it('toggles reactions on the thread and on replies', async () => {
    const t = await post();
    const r = await svc.createReply(deps, bob, t.id, { body: rich('<p>x</p>') });
    expect(await svc.toggleReaction(deps, alice, t.id, r.id, '👍')).toBe(true);
    expect(await svc.toggleReaction(deps, bob, t.id, r.id, '👍')).toBe(true);
    expect(await svc.toggleReaction(deps, alice, t.id, t.id, '👀')).toBe(true);
    let d = await svc.getThread(deps, alice, t.id);
    expect(d?.posts[0].reactions).toEqual([{ emoji: '👍', count: 2, mine: true }]);
    expect(d?.reactions).toEqual([{ emoji: '👀', count: 1, mine: true }]);
    expect(await svc.toggleReaction(deps, alice, t.id, r.id, '👍')).toBe(false);
    d = await svc.getThread(deps, alice, t.id);
    expect(d?.posts[0].reactions).toEqual([{ emoji: '👍', count: 1, mine: false }]);
    await expectCode(svc.toggleReaction(deps, alice, t.id, r.id, '💩'), 'invalid');
  });
});

describe('listing', () => {
  it('filters by category and paginates', async () => {
    for (let i = 0; i < 5; i++) {
      tick();
      await post(alice, { title: `Aletheia question ${i}` });
    }
    tick();
    await post(alice, { categorySlug: 'minima', title: 'Minima question' });
    const all = await svc.listThreads(deps, alice, { pageSize: 4 });
    expect(all).toMatchObject({ total: 6, page: 1, pageSize: 4 });
    expect(all.items).toHaveLength(4);
    expect(all.items[0].title).toBe('Minima question');
    const p2 = await svc.listThreads(deps, alice, { pageSize: 4, page: 2 });
    expect(p2.items).toHaveLength(2);
    const minima = await svc.listThreads(deps, alice, { categorySlug: 'minima' });
    expect(minima.items.map((t) => t.category.slug)).toEqual(['minima']);
  });
  it('sorts latest (pinned first), top and unanswered', async () => {
    tick();
    const a = await post(alice, { title: 'Alpha thread' });
    tick();
    const b = await post(alice, { title: 'Bravo thread' });
    tick();
    const c = await post(alice, { title: 'Charlie thread' });
    tick();
    await svc.createReply(deps, bob, a.id, { body: rich('<p>1</p>') });
    tick();
    await svc.createReply(deps, bob, a.id, { body: rich('<p>2</p>') });
    tick();
    await svc.createReply(deps, bob, b.id, { body: rich('<p>1</p>') });
    const titles = async (sort: svc.ThreadSort) => (await svc.listThreads(deps, alice, { sort })).items.map((t) => t.title);
    expect(await titles('latest')).toEqual(['Bravo thread', 'Alpha thread', 'Charlie thread']);
    expect(await titles('top')).toEqual(['Alpha thread', 'Bravo thread', 'Charlie thread']);
    expect(await titles('unanswered')).toEqual(['Charlie thread']);
    await svc.setPinned(deps, admin, c.id, true);
    expect((await titles('latest'))[0]).toBe('Charlie thread');
  });
  it('includes an excerpt and bookmark state', async () => {
    const t = await post(alice, { body: rich('<p>' + 'word '.repeat(100) + '</p>') });
    await svc.toggleBookmark(deps, alice, t.id);
    const [row] = (await svc.listThreads(deps, alice)).items;
    expect(row.excerpt.length).toBe(200);
    expect(row.bookmarked).toBe(true);
    expect((await svc.listThreads(deps, bob)).items[0].bookmarked).toBe(false);
  });
});

describe('bookmarks', () => {
  it('toggles, lists newest bookmark first, and is per member', async () => {
    const t1 = await post(alice, { title: 'First thread' });
    const t2 = await post(alice, { title: 'Second thread' });
    expect(await svc.toggleBookmark(deps, bob, t1.id)).toBe(true);
    tick();
    expect(await svc.toggleBookmark(deps, bob, t2.id)).toBe(true);
    expect((await svc.listBookmarks(deps, bob)).items.map((t) => t.title)).toEqual(['Second thread', 'First thread']);
    expect((await svc.listBookmarks(deps, alice)).total).toBe(0);
    expect(await svc.toggleBookmark(deps, bob, t2.id)).toBe(false);
    expect((await svc.listBookmarks(deps, bob)).items.map((t) => t.title)).toEqual(['First thread']);
  });
  it('rejects bookmarking a missing thread', async () => {
    await expectCode(svc.toggleBookmark(deps, bob, crypto.randomUUID()), 'not_found');
    await expectCode(svc.toggleBookmark(deps, bob, 'nope'), 'not_found');
  });
});

describe('views are admin-only', () => {
  it('counts a repeat visit inside an hour once, later visits again', async () => {
    const t = await post();
    await svc.recordView(deps, bob, t.id);
    await svc.recordView(deps, bob, t.id);
    await svc.recordView(deps, alice, t.id);
    expect(await svc.getViewCounts(deps, admin, [t.id])).toEqual({ [t.id]: 3 - 1 });
    tick(2 * 3_600_000);
    await svc.recordView(deps, bob, t.id);
    expect(await svc.getViewCounts(deps, admin, [t.id])).toEqual({ [t.id]: 3 });
  });
  it('refuses getViewCounts to members', async () => {
    const t = await post();
    await expectCode(svc.getViewCounts(deps, alice, [t.id]), 'forbidden');
  });
  it('never puts counts in member payloads, and does in admin payloads', async () => {
    const t = await post();
    await svc.recordView(deps, bob, t.id);
    await svc.recordView(deps, alice, t.id);
    const asMember = JSON.stringify([await svc.listThreads(deps, bob), await svc.getThread(deps, bob, t.id), await svc.listBookmarks(deps, bob)]);
    expect(asMember).not.toMatch(/"views"|"viewers"/);
    expect((await svc.listThreads(deps, admin)).items[0].views).toBe(2);
    const d = await svc.getThread(deps, admin, t.id);
    expect(d?.views).toBe(2);
    expect(d?.viewers).toBe(2);
  });
  it('tells the viewer when they last opened a thread', async () => {
    const t = await post();
    expect((await svc.getThread(deps, bob, t.id))?.viewerLastViewedAt).toBeNull();
    await svc.recordView(deps, bob, t.id);
    expect((await svc.getThread(deps, bob, t.id))?.viewerLastViewedAt).toEqual(clock);
  });
  it('ignores views of missing threads', async () => {
    await expect(svc.recordView(deps, bob, crypto.randomUUID())).resolves.toBeUndefined();
    await expect(svc.recordView(deps, bob, 'nope')).resolves.toBeUndefined();
  });
});

describe('identity masking', () => {
  it('shows the username or the handle and never the account to members', async () => {
    const handle = (await svc.getOwnProfile(deps, alice)).handle;
    const asName = await post(alice, { title: 'Posted by username' });
    await svc.updateOwnProfile(deps, alice, { displayMode: 'handle' });
    const asHandle = await post(alice, { title: 'Posted by handle' });
    const r = await svc.createReply(deps, alice, asName.id, { body: rich('<p>reply as handle</p>') });
    const named = await svc.getThread(deps, bob, asName.id);
    const masked = await svc.getThread(deps, bob, asHandle.id);
    expect(named?.author).toEqual({ name: 'alice', mode: 'username', isStaff: false });
    expect(masked?.author).toEqual({ name: handle, mode: 'handle', isStaff: false });
    // The earlier thread keeps its username snapshot; the new reply uses the handle. Nothing links them.
    expect(named?.posts.find((p) => p.id === r.id)?.author.name).toBe(handle);
    const payload = JSON.stringify([masked, named, await svc.listThreads(deps, bob), await svc.searchMentionable(deps, 'a')]);
    expect(payload).not.toContain('alice@example.com');
    expect(payload).not.toContain('auth0|alice');
  });
  it('shows admins the real account behind a handle', async () => {
    await svc.updateOwnProfile(deps, alice, { displayMode: 'handle' });
    const t = await post(alice);
    const r = await svc.createReply(deps, alice, t.id, { body: rich('<p>x</p>') });
    const d = await svc.getThread(deps, admin, t.id);
    expect(d?.author.account).toEqual({ sub: alice.sub, email: 'alice@example.com' });
    expect(d?.posts.find((p) => p.id === r.id)?.author.account?.email).toBe('alice@example.com');
    const handle = d!.author.name;
    expect(await svc.findAccountByName(deps, admin, `@${handle}`)).toMatchObject({ email: 'alice@example.com', handle });
    expect(await svc.findAccountByName(deps, admin, 'nobody-here')).toBeNull();
    await expectCode(svc.findAccountByName(deps, alice, handle), 'forbidden');
  });
  it('flags admins posting under their username as staff, but not under a handle', async () => {
    const t1 = await post(admin, { title: 'Staff announcement' });
    expect((await svc.getThread(deps, bob, t1.id))?.author.isStaff).toBe(true);
    await svc.updateOwnProfile(deps, admin, { displayMode: 'handle' });
    const t2 = await post(admin, { title: 'Anonymous admin note' });
    expect((await svc.getThread(deps, bob, t2.id))?.author.isStaff).toBe(false);
  });
});

describe('mentions', () => {
  it('records and highlights mentions of usernames and of handles in use', async () => {
    await svc.getOwnProfile(deps, bob);
    const carol = member('carol');
    await svc.updateOwnProfile(deps, carol, { displayMode: 'handle' });
    const carolHandle = (await svc.getOwnProfile(deps, carol)).handle;
    const t = await post(alice, { body: rich(`<p>Thanks @bob and @${carolHandle}, and @ghost, mail x@bob.com</p>`) });
    const rows = await db.select().from(forumMentions);
    expect(rows.map((r) => r.mentionedSub).sort()).toEqual([bob.sub, carol.sub].sort());
    expect(rows.every((r) => r.threadId === t.id && r.postId === null)).toBe(true);
    const body = (await svc.getThread(deps, alice, t.id))!.bodyHtml;
    expect(body).toContain('<span class="mention" data-mention="bob">@bob</span>');
    expect(body).toContain(`data-mention="${carolHandle}"`);
    expect(body).not.toContain('data-mention="ghost"');
  });
  it('does not resolve the username of a member who posts under a handle', async () => {
    const carol = member('carol');
    await svc.updateOwnProfile(deps, carol, { displayMode: 'handle' });
    await post(alice, { body: rich('<p>hello @carol</p>') });
    expect(await db.select().from(forumMentions)).toHaveLength(0);
  });
  it('records reply mentions against the reply', async () => {
    await svc.getOwnProfile(deps, bob);
    const t = await post(alice);
    const r = await svc.createReply(deps, alice, t.id, { body: md('cc @bob, @bob again') });
    const rows = await db.select().from(forumMentions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ postId: r.id, mentionedSub: bob.sub, threadId: t.id });
  });
  it('searches mentionable names by prefix, only by current display name', async () => {
    await svc.getOwnProfile(deps, member('prism'));
    await svc.getOwnProfile(deps, member('prince'));
    const carol = member('pretzel');
    await svc.updateOwnProfile(deps, carol, { displayMode: 'handle' });
    const found = await svc.searchMentionable(deps, '@pri');
    expect(found.map((f) => f.name)).toEqual(['prince', 'prism']);
    expect(await svc.searchMentionable(deps, 'pretzel')).toEqual([]);
    expect(await svc.searchMentionable(deps, '%')).toEqual([]);
    expect((await svc.searchMentionable(deps, '')).length).toBeGreaterThan(0);
  });
});

describe('similar threads', () => {
  beforeEach(async () => {
    await post(alice, { title: 'Workflow for reviewing flagged results' });
    tick();
    await post(alice, { title: 'Import fails on large case files' });
    tick();
    await post(alice, { categorySlug: 'minima', title: 'Gradient clipping question' });
  });
  it('finds threads by shared title words, best match first', async () => {
    const r = await svc.findSimilarThreads(deps, 'Import of large files fails');
    expect(r[0].title).toBe('Import fails on large case files');
  });
  it('is case-insensitive and ignores stop words and short titles', async () => {
    expect((await svc.findSimilarThreads(deps, 'REVIEWING')).map((t) => t.title)).toEqual(['Workflow for reviewing flagged results']);
    expect(await svc.findSimilarThreads(deps, 'the and for')).toEqual([]);
    expect(await svc.findSimilarThreads(deps, 'hi')).toEqual([]);
  });
  it('treats % and _ literally and can scope to a category', async () => {
    expect(await svc.findSimilarThreads(deps, '%%% ___')).toEqual([]);
    expect(await svc.findSimilarThreads(deps, 'question', { categorySlug: 'aletheia' })).toEqual([]);
    expect((await svc.findSimilarThreads(deps, 'question', { categorySlug: 'minima' }))[0].categoryName).toBe('Minima');
  });
});

describe('moderation', () => {
  it('lets only admins pin, lock and delete', async () => {
    const t = await post();
    await expectCode(svc.setPinned(deps, alice, t.id, true), 'forbidden');
    await expectCode(svc.setLocked(deps, alice, t.id, true), 'forbidden');
    await expectCode(svc.deleteThread(deps, alice, t.id), 'forbidden');
    await svc.setPinned(deps, admin, t.id, true);
    await svc.setLocked(deps, admin, t.id, true);
    const d = await svc.getThread(deps, bob, t.id);
    expect([d?.pinned, d?.locked]).toEqual([true, true]);
    await svc.setLocked(deps, admin, t.id, false);
    await expectCode(svc.setPinned(deps, admin, crypto.randomUUID(), true), 'not_found');
  });
  it('deletes a thread with its replies, bookmarks, views, reactions and mentions', async () => {
    await svc.getOwnProfile(deps, bob);
    const t = await post(alice, { body: rich('<p>hi @bob</p>') });
    await svc.createReply(deps, bob, t.id, { body: rich('<p>x</p>') });
    await svc.toggleBookmark(deps, bob, t.id);
    await svc.toggleReaction(deps, bob, t.id, t.id, '👍');
    await svc.recordView(deps, bob, t.id);
    await svc.deleteThread(deps, admin, t.id);
    expect(await svc.getThread(deps, bob, t.id)).toBeNull();
    expect((await svc.listBookmarks(deps, bob)).total).toBe(0);
    expect(await db.select().from(forumMentions)).toHaveLength(0);
    await expectCode(svc.deleteThread(deps, admin, t.id), 'not_found');
  });
  it('deletes a reply, fixing the count, the solution and quotes of it', async () => {
    const t = await post();
    const r1 = await svc.createReply(deps, bob, t.id, { body: rich('<p>one</p>') });
    await svc.createReply(deps, alice, t.id, { body: rich('<p>two</p>'), quotePostId: r1.id });
    await svc.markSolution(deps, alice, t.id, r1.id);
    await expectCode(svc.deletePost(deps, bob, r1.id), 'forbidden');
    await svc.deletePost(deps, admin, r1.id);
    const d = await svc.getThread(deps, alice, t.id);
    expect(d).toMatchObject({ replyCount: 1, answered: false });
    expect(d?.posts).toHaveLength(1);
    expect(d?.posts[0].quotePostId).toBeNull();
  });
});
