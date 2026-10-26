// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as cmd from '@/lib/forum/commands';
import * as svc from '@/lib/forum/service';
import type { Db, Deps } from '@/lib/forum/service';
import { admin, makeDeps, member, newDb, rich } from './helpers';

let db: Db;
let deps: Deps;
const alice = member('alice');
const bob = member('bob');

beforeEach(async () => {
  db = await newDb();
  deps = makeDeps(db);
});

const thread = (over = {}) => ({ categorySlug: 'aletheia', title: 'Import fails on large files', body: rich('<p>It stops at parsing.</p>'), ...over });
const confirm = (v = alice) => svc.updateOwnProfile(deps, v, { username: v.email.split('@')[0] });

describe('posting', () => {
  it('asks new members to confirm their username before the first post', async () => {
    const r = await cmd.submitThread(deps, alice, thread());
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/confirm your username/i) });
    expect((await svc.listThreads(deps, alice)).total).toBe(0);
  });
  it('creates a thread and a reply once the username is confirmed', async () => {
    await confirm();
    const t = await cmd.submitThread(deps, alice, thread());
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    await confirm(bob);
    const r = await cmd.submitReply(deps, bob, t.data.id, { body: rich('<p>Try a smaller file.</p>') });
    expect(r.ok).toBe(true);
    expect((await svc.getThread(deps, bob, t.data.id))?.posts).toHaveLength(1);
  });
  it('returns service messages for bad input and sanitizes client HTML', async () => {
    await confirm();
    const bad = await cmd.submitThread(deps, alice, thread({ title: 'x' }));
    expect(bad).toEqual({ ok: false, error: expect.stringMatching(/title/i) });
    const t = await cmd.submitThread(deps, alice, thread({ body: rich('<p>hi</p><script>alert(1)</script><img src=x onerror=alert(1)>') }));
    if (!t.ok) throw new Error('expected ok');
    const html = (await svc.getThread(deps, alice, t.data.id))?.bodyHtml ?? '';
    expect(html).not.toMatch(/script|img|onerror/i);
  });
  it('reports a locked thread to a member as a message', async () => {
    await confirm();
    const t = await cmd.submitThread(deps, alice, thread());
    if (!t.ok) throw new Error('expected ok');
    await svc.setLocked(deps, admin, t.data.id, true);
    await confirm(bob);
    expect(await cmd.submitReply(deps, bob, t.data.id, { body: rich('<p>hi</p>') })).toEqual({ ok: false, error: expect.stringMatching(/locked/i) });
  });
  it('hides unexpected errors behind a generic message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { ...deps, db: {} as Db };
    expect(await cmd.bookmark(broken, alice, 'x')).toEqual({ ok: false, error: 'Something went wrong. Try again.' });
    spy.mockRestore();
  });
});

describe('reactions, bookmarks, solutions', () => {
  it('toggles reactions and bookmarks, and only the author may mark a solution', async () => {
    await confirm();
    const t = await cmd.submitThread(deps, alice, thread());
    if (!t.ok) throw new Error('expected ok');
    const id = t.data.id;
    expect(await cmd.react(deps, bob, id, id, '👍')).toEqual({ ok: true, data: true });
    expect(await cmd.react(deps, bob, id, id, '👍')).toEqual({ ok: true, data: false });
    expect((await cmd.react(deps, bob, id, id, '💥')).ok).toBe(false);
    expect(await cmd.bookmark(deps, bob, id)).toEqual({ ok: true, data: true });
    await confirm(bob);
    const reply = await cmd.submitReply(deps, bob, id, { body: rich('<p>Answer</p>') });
    if (!reply.ok) throw new Error('expected ok');
    expect((await cmd.setSolution(deps, bob, id, reply.data.id)).ok).toBe(false);
    expect((await cmd.setSolution(deps, alice, id, reply.data.id)).ok).toBe(true);
    expect((await svc.getThread(deps, alice, id))?.answered).toBe(true);
  });
});

describe('profile, suggestions and mentions', () => {
  it('confirms and changes the username and display mode', async () => {
    const r = await cmd.saveProfile(deps, alice, { username: 'alice_w', displayMode: 'handle' });
    expect(r.ok && r.data.usernameConfirmed && r.data.displayMode).toBe('handle');
    expect(await cmd.saveProfile(deps, bob, { username: 'admin' })).toEqual({ ok: false, error: expect.any(String) });
    await cmd.saveProfile(deps, bob, { username: 'bobby' });
    expect(await cmd.saveProfile(deps, alice, { username: 'bobby' })).toEqual({ ok: false, error: expect.stringMatching(/taken/i) });
  });
  it('finds similar threads and mentionable members', async () => {
    await confirm();
    await cmd.submitThread(deps, alice, thread());
    expect((await cmd.similar(deps, 'import large files fails')).map((s) => s.title)).toEqual(['Import fails on large files']);
    expect(await cmd.similar(deps, 'a')).toEqual([]);
    await svc.getOwnProfile(deps, bob);
    expect((await cmd.mentions(deps, '@bo')).map((m) => m.name)).toEqual(['bob']);
  });
});

describe('moderation', () => {
  it('lets admins pin, lock and delete, and refuses members', async () => {
    await confirm();
    const t = await cmd.submitThread(deps, alice, thread());
    if (!t.ok) throw new Error('expected ok');
    expect((await cmd.moderate(deps, alice, { kind: 'pin', threadId: t.data.id, value: true })).ok).toBe(false);
    expect((await cmd.moderate(deps, admin, { kind: 'pin', threadId: t.data.id, value: true })).ok).toBe(true);
    expect((await cmd.moderate(deps, admin, { kind: 'lock', threadId: t.data.id, value: true })).ok).toBe(true);
    expect((await cmd.moderate(deps, admin, { kind: 'deleteThread', threadId: t.data.id })).ok).toBe(true);
    expect((await svc.listThreads(deps, alice)).total).toBe(0);
  });
});
