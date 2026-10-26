import type { Metadata } from 'next';
import { ThreadListView } from '@/components/forum/thread-list-view';
import { requireForumMember } from '@/lib/forum/gate';
import { parseListParams } from '@/lib/forum/list-params';
import { forumDeps } from '@/lib/forum/server';
import { listThreads } from '@/lib/forum/service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Forum', robots: { index: false, follow: false } };

export default async function ForumPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireForumMember('/forum');
  const { sort, page } = parseListParams(await searchParams);
  const data = await listThreads(forumDeps(), viewer, { sort, page });
  return <ThreadListView title="All threads" base="/forum" sort={sort} data={data} showCategory />;
}
