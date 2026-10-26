'use server';

// Server actions for the forum. Each one calls requireForumMember() first: pages and layouts do not
// protect actions, which are reachable by POST on their own. The logic lives in lib/forum/commands.ts.

import { revalidatePath } from 'next/cache';
import { requireForumMember } from '@/lib/forum/gate';
import { forumDeps } from '@/lib/forum/server';
import * as cmd from '@/lib/forum/commands';
import type { NewReplyInput, NewThreadInput } from '@/lib/forum/service';

export async function createThreadAction(input: NewThreadInput) {
  const viewer = await requireForumMember('/forum/new');
  const r = await cmd.submitThread(forumDeps(), viewer, input);
  if (r.ok) revalidatePath('/forum', 'layout');
  return r;
}

export async function createReplyAction(threadId: string, input: NewReplyInput) {
  const viewer = await requireForumMember(`/forum/t/${threadId}`);
  const r = await cmd.submitReply(forumDeps(), viewer, threadId, input);
  if (r.ok) revalidatePath(`/forum/t/${threadId}`);
  return r;
}

export async function toggleReactionAction(threadId: string, targetId: string, emoji: string) {
  const viewer = await requireForumMember(`/forum/t/${threadId}`);
  return cmd.react(forumDeps(), viewer, threadId, targetId, emoji);
}

export async function toggleBookmarkAction(threadId: string) {
  const viewer = await requireForumMember(`/forum/t/${threadId}`);
  const r = await cmd.bookmark(forumDeps(), viewer, threadId);
  if (r.ok) revalidatePath('/forum/bookmarks');
  return r;
}

export async function markSolutionAction(threadId: string, postId: string | null) {
  const viewer = await requireForumMember(`/forum/t/${threadId}`);
  const r = await cmd.setSolution(forumDeps(), viewer, threadId, postId);
  if (r.ok) revalidatePath(`/forum/t/${threadId}`);
  return r;
}

export async function saveProfileAction(input: { displayMode?: 'username' | 'handle'; username?: string }) {
  const viewer = await requireForumMember('/forum/settings');
  const r = await cmd.saveProfile(forumDeps(), viewer, input);
  if (r.ok) revalidatePath('/forum', 'layout');
  return r;
}

export async function similarThreadsAction(title: string, categorySlug?: string) {
  await requireForumMember('/forum/new');
  return cmd.similar(forumDeps(), String(title), categorySlug);
}

export async function mentionSearchAction(prefix: string) {
  await requireForumMember('/forum');
  return cmd.mentions(forumDeps(), String(prefix));
}

export async function moderateAction(action: cmd.AdminAction) {
  const viewer = await requireForumMember('/forum');
  const r = await cmd.moderate(forumDeps(), viewer, action);
  if (r.ok) revalidatePath('/forum', 'layout');
  return r;
}
