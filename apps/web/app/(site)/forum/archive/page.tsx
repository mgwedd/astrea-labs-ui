import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Archive } from 'lucide-react';
import { Empty } from '@astrea/ui';
import { Pager, ThreadList } from '@/components/forum/thread-list';
import { requireForumMember } from '@/lib/forum/gate';
import { parseListParams } from '@/lib/forum/list-params';
import { forumDeps } from '@/lib/forum/server';
import { listThreads } from '@/lib/forum/service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Archive · Forum', robots: { index: false, follow: false } };

/** Admin only. Archived threads are hidden from members everywhere else. */
export default async function ArchivePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireForumMember('/forum/archive');
  if (!viewer.isAdmin) notFound();
  const { page } = parseListParams(await searchParams);
  const data = await listThreads(forumDeps(), viewer, { archived: true, page });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Archive</h1>
      {data.items.length === 0 ? (
        <Empty icon={Archive} title="No archived threads" />
      ) : (
        <>
          <ThreadList items={data.items} showCategory />
          <Pager base="/forum/archive" sort="latest" data={data} />
        </>
      )}
    </div>
  );
}
