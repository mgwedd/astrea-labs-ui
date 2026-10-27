import {
  createReply,
  createThread,
  deletePost,
  deleteThread,
  findSimilarThreads,
  ForumError,
  getOwnProfile,
  markSolution,
  searchMentionable,
  setLocked,
  setPinned,
  setThreadKind,
  setThreadStatus,
  toggleBookmark,
  toggleReaction,
  toggleVote,
  updateOwnProfile,
  type Deps,
  type Mentionable,
  type NewReplyInput,
  type NewThreadInput,
  type OwnProfile,
  type SimilarThread,
  type StatusChangeInput,
  type ThreadKind,
  type Viewer,
} from './service';

// The logic behind the forum server actions (app/(site)/forum/actions.ts). Kept apart from the
// 'use server' file so it can be tested with an in-memory database. Callers have already passed
// requireForumMember(); every command trusts the `viewer` it is given, like the services.

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T>(data: T): Result<T> => ({ ok: true, data });

/** Run a service call. ForumError messages are user-safe and returned; anything else is logged and hidden. */
async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof ForumError) return { ok: false, error: e.message };
    console.error('forum command failed', e);
    return { ok: false, error: 'Something went wrong. Try again.' };
  }
}

/** New members must confirm their username before their first post. */
async function needsConfirmedUsername(deps: Deps, viewer: Viewer): Promise<boolean> {
  return !(await getOwnProfile(deps, viewer)).usernameConfirmed;
}

const CONFIRM_FIRST = 'Confirm your username in forum settings before you post.';

export const submitThread = (deps: Deps, viewer: Viewer, input: NewThreadInput) =>
  run(async () => {
    if (await needsConfirmedUsername(deps, viewer)) throw new ForumError('forbidden', CONFIRM_FIRST);
    return createThread(deps, viewer, input);
  });

export const submitReply = (deps: Deps, viewer: Viewer, threadId: string, input: NewReplyInput) =>
  run(async () => {
    if (await needsConfirmedUsername(deps, viewer)) throw new ForumError('forbidden', CONFIRM_FIRST);
    return createReply(deps, viewer, threadId, input);
  });

export const react = (deps: Deps, viewer: Viewer, threadId: string, targetId: string, emoji: string) =>
  run(() => toggleReaction(deps, viewer, threadId, targetId, emoji));

/** "Me too" on a bug report or feature request. Returns true when the vote is now set. */
export const vote = (deps: Deps, viewer: Viewer, threadId: string) => run(() => toggleVote(deps, viewer, threadId));

export const bookmark = (deps: Deps, viewer: Viewer, threadId: string) => run(() => toggleBookmark(deps, viewer, threadId));

export const setSolution = (deps: Deps, viewer: Viewer, threadId: string, postId: string | null) =>
  run(() => markSolution(deps, viewer, threadId, postId));

export const saveProfile = (deps: Deps, viewer: Viewer, input: { displayMode?: 'username' | 'handle'; username?: string }): Promise<Result<OwnProfile>> =>
  run(() => updateOwnProfile(deps, viewer, input));

/** Similar existing threads for the compose screen. Never throws: suggestions are optional. */
export async function similar(deps: Deps, title: string, categorySlug?: string): Promise<SimilarThread[]> {
  try {
    return await findSimilarThreads(deps, title.slice(0, 140), { limit: 5, categorySlug: categorySlug || undefined });
  } catch (e) {
    console.error('forum similar threads failed', e);
    return [];
  }
}

/** Members matching an @mention prefix. Never throws. */
export async function mentions(deps: Deps, prefix: string): Promise<Mentionable[]> {
  try {
    return await searchMentionable(deps, prefix.slice(0, 33), 6);
  } catch (e) {
    console.error('forum mention search failed', e);
    return [];
  }
}

export type AdminAction =
  | { kind: 'pin'; threadId: string; value: boolean }
  | { kind: 'lock'; threadId: string; value: boolean }
  | { kind: 'status'; threadId: string; change: StatusChangeInput }
  | { kind: 'threadKind'; threadId: string; value: ThreadKind }
  | { kind: 'deleteThread'; threadId: string }
  | { kind: 'deletePost'; postId: string };

/** Moderation. The services throw `forbidden` for non-admins, which comes back as a message. */
export const moderate = (deps: Deps, viewer: Viewer, action: AdminAction) =>
  run(async () => {
    switch (action.kind) {
      case 'pin':
        return setPinned(deps, viewer, action.threadId, action.value);
      case 'lock':
        return setLocked(deps, viewer, action.threadId, action.value);
      case 'status':
        return setThreadStatus(deps, viewer, action.threadId, action.change);
      case 'threadKind':
        return setThreadKind(deps, viewer, action.threadId, action.value);
      case 'deleteThread':
        return deleteThread(deps, viewer, action.threadId);
      case 'deletePost':
        return deletePost(deps, viewer, action.postId);
    }
  });
