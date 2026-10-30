// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import * as svc from '@/lib/forum/service';
import { ForumError, type Db, type Deps } from '@/lib/forum/service';
import { statusLabel } from '@/lib/forum/reports';
import { admin, makeDeps, member, newDb, rich } from './helpers';

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
const carol = member('carol');
const open = (kind: svc.NewThreadInput['kind'], title = 'Export crashes on save', viewer = alice) =>
  svc.createThread(deps, viewer, { categorySlug: 'aletheia', title, body: rich('<p>Details.</p>'), kind });
const expectCode = async (p: Promise<unknown>, code: svc.ErrorCode) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ForumError);
  expect((err as ForumError).code).toBe(code);
};

describe('reports', () => {
  it('opens bugs and features as open, discussions with no status', async () => {
    const bug = await open('bug');
    const feat = await open('feature', 'Dark mode for the reader');
    const talk = await open(undefined, 'How do you use it?');
    const get = async (id: string) => (await svc.getThread(deps, alice, id))!;
    expect(await get(bug.id)).toMatchObject({ kind: 'bug', status: 'open', voteCount: 0 });
    expect(await get(feat.id)).toMatchObject({ kind: 'feature', status: 'open' });
    expect(await get(talk.id)).toMatchObject({ kind: 'discussion', status: null });
  });

  it('counts one vote per member, toggles off, and keeps the count in sync', async () => {
    const { id } = await open('bug');
    expect(await svc.toggleVote(deps, bob, id)).toBe(true);
    expect(await svc.toggleVote(deps, carol, id)).toBe(true);
    expect((await svc.getThread(deps, bob, id))!).toMatchObject({ voteCount: 2, voted: true });
    expect(await svc.toggleVote(deps, bob, id)).toBe(false);
    expect((await svc.getThread(deps, bob, id))!).toMatchObject({ voteCount: 1, voted: false });
  });

  it('refuses votes on discussions and from the author', async () => {
    const talk = await open(undefined, 'General chat');
    await expectCode(svc.toggleVote(deps, bob, talk.id), 'invalid');
    const bug = await open('bug');
    await expectCode(svc.toggleVote(deps, alice, bug.id), 'forbidden');
  });

  it('lets only admins change status, and records each change with its note', async () => {
    const { id } = await open('bug');
    await expectCode(svc.setThreadStatus(deps, bob, id, { status: 'acknowledged' }), 'forbidden');
    tick();
    await svc.setThreadStatus(deps, admin, id, { status: 'acknowledged', note: 'Reproduced on 1.2.' });
    tick();
    await svc.setThreadStatus(deps, admin, id, { status: 'done' });
    const t = (await svc.getThread(deps, alice, id))!;
    expect(t.status).toBe('done');
    expect(t.statusEvents.map((e) => [e.from, e.to, e.note])).toEqual([
      ['open', 'acknowledged', 'Reproduced on 1.2.'],
      ['acknowledged', 'done', null],
    ]);
    expect(t.lastActivityAt.getTime()).toBe(clock.getTime());
  });

  it('skips a no-op status change and refuses a status on a discussion', async () => {
    const { id } = await open('feature');
    await svc.setThreadStatus(deps, admin, id, { status: 'open' });
    expect((await svc.getThread(deps, alice, id))!.statusEvents).toHaveLength(0);
    const talk = await open(undefined, 'Chat');
    await expectCode(svc.setThreadStatus(deps, admin, talk.id, { status: 'planned' }), 'invalid');
  });

  it('marks a duplicate only against another report, and blocks new votes on it', async () => {
    const orig = await open('bug', 'Crash on save');
    const dup = await open('bug', 'Saving crashes', bob);
    const talk = await open(undefined, 'Chat');
    await svc.toggleVote(deps, carol, dup.id);
    await expectCode(svc.setThreadStatus(deps, admin, dup.id, { status: 'duplicate' }), 'invalid');
    await expectCode(svc.setThreadStatus(deps, admin, dup.id, { status: 'duplicate', duplicateOfId: dup.id }), 'invalid');
    await expectCode(svc.setThreadStatus(deps, admin, dup.id, { status: 'duplicate', duplicateOfId: talk.id }), 'not_found');
    await svc.setThreadStatus(deps, admin, dup.id, { status: 'duplicate', duplicateOfId: orig.id });
    expect((await svc.getThread(deps, alice, dup.id))!.duplicateOf).toEqual({ id: orig.id, title: 'Crash on save' });
    // An archived original stays hidden from members.
    await svc.setArchived(deps, admin, orig.id, true);
    expect((await svc.getThread(deps, alice, dup.id))!.duplicateOf).toBeNull();
    expect((await svc.getThread(deps, admin, dup.id))!.duplicateOf).toEqual({ id: orig.id, title: 'Crash on save' });
    await svc.setArchived(deps, admin, orig.id, false);
    await expectCode(svc.toggleVote(deps, alice, dup.id), 'invalid');
    // An existing vote can still be taken back.
    expect(await svc.toggleVote(deps, carol, dup.id)).toBe(false);
    // No chains or loops: a duplicate cannot be the original of another.
    await expectCode(svc.setThreadStatus(deps, admin, orig.id, { status: 'duplicate', duplicateOfId: dup.id }), 'invalid');
    // Re-saving the same duplicate link with no note writes nothing new.
    const before = (await svc.getThread(deps, alice, dup.id))!.statusEvents.length;
    await svc.setThreadStatus(deps, admin, dup.id, { status: 'duplicate', duplicateOfId: orig.id });
    expect((await svc.getThread(deps, alice, dup.id))!.statusEvents).toHaveLength(before);
  });

  it('reclassifies a thread: a discussion becomes an open report, and back', async () => {
    const { id } = await open(undefined, 'Is this a bug?');
    await expectCode(svc.setThreadKind(deps, bob, id, 'bug'), 'forbidden');
    await svc.setThreadKind(deps, admin, id, 'bug');
    expect((await svc.getThread(deps, alice, id))!).toMatchObject({ kind: 'bug', status: 'open' });
    await svc.setThreadKind(deps, admin, id, 'discussion');
    expect((await svc.getThread(deps, alice, id))!).toMatchObject({ kind: 'discussion', status: null });
  });

  it('filters the list by kind and active/closed status, and sorts by votes', async () => {
    const a = await open('bug', 'Bug A');
    const b = await open('bug', 'Bug B');
    const f = await open('feature', 'Feature F');
    await open(undefined, 'Just talk');
    await svc.toggleVote(deps, bob, b.id);
    await svc.toggleVote(deps, carol, b.id);
    await svc.toggleVote(deps, bob, f.id);
    await svc.setThreadStatus(deps, admin, a.id, { status: 'done' });
    const titles = async (o: svc.ListThreadsOptions) => (await svc.listThreads(deps, alice, o)).items.map((t) => t.title);
    expect(await titles({ kind: 'report', sort: 'votes' })).toEqual(['Bug B', 'Feature F', 'Bug A']);
    expect(await titles({ kind: 'report', status: 'active', sort: 'votes' })).toEqual(['Bug B', 'Feature F']);
    expect(await titles({ kind: 'bug', status: 'closed' })).toEqual(['Bug A']);
    expect(await titles({ kind: 'feature' })).toEqual(['Feature F']);
    expect((await titles({})).length).toBe(4);
  });
});

describe('status labels', () => {
  it('words statuses for bugs and features', () => {
    expect(statusLabel('bug', 'acknowledged')).toBe('Confirmed');
    expect(statusLabel('feature', 'acknowledged')).toBe('Under consideration');
    expect(statusLabel('bug', 'done')).toBe('Fixed');
    expect(statusLabel('feature', 'done')).toBe('Shipped');
    expect(statusLabel('bug', 'declined')).toBe("Won't fix");
    expect(statusLabel('feature', 'in_progress')).toBe('In progress');
  });
});
