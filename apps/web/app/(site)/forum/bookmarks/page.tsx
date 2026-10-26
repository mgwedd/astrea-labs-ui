import type { Metadata } from 'next';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { Button, Empty } from '@astrea/ui';
import { Pager, ThreadList } from '@/components/forum/thread-list';
import { requireForumMember } from '@/lib/forum/gate';
import { parseListParams } from '@/lib/forum/list-params';
import { forumDeps } from '@/lib/forum/server';
import { listBookmarks } from '@/lib/forum/service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Bookmarks · Forum', robots: { index: false, follow: false } };

export default async function BookmarksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireForumMember('/forum/bookmarks');
  const { page } = parseListParams(await searchParams);
  const data = await listBookmarks(forumDeps(), viewer, { page });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Bookmarks</h1>
      {data.items.length === 0 ? (
        <Empty
          icon={Bookmark}
          title="No bookmarks yet"
          description="Bookmark a thread to find it here."
          action={
            <Button asChild variant="outline">
              <Link href="/forum">Browse threads</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ThreadList items={data.items} showCategory />
          <Pager base="/forum/bookmarks" sort="latest" data={data} />
        </>
      )}
    </div>
  );
}
