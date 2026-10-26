import Link from 'next/link';
import { MessageSquare, PenLine } from 'lucide-react';
import { Button, Empty } from '@astrea/ui';
import { listHref } from '@/lib/forum/list-params';
import type { Page, ThreadSort, ThreadSummary } from '@/lib/forum/service';
import { Pager, SortTabs, ThreadList } from './thread-list';

/** Heading, sort tabs, thread rows and pager shared by the index and category pages. */
export function ThreadListView({
  title,
  base,
  sort,
  data,
  showCategory,
  categorySlug,
}: {
  title: string;
  base: string;
  sort: ThreadSort;
  data: Page<ThreadSummary>;
  showCategory: boolean;
  categorySlug?: string;
}) {
  const newHref = categorySlug ? `/forum/new?category=${encodeURIComponent(categorySlug)}` : '/forum/new';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <SortTabs base={base} sort={sort} />
      </div>
      {data.items.length === 0 ? (
        <Empty
          icon={MessageSquare}
          title={sort === 'unanswered' ? 'Nothing unanswered' : 'No threads yet'}
          description={sort === 'unanswered' ? 'Every thread here has at least one reply.' : 'Start the first conversation.'}
          action={
            sort === 'unanswered' ? (
              <Button asChild variant="outline">
                <Link href={listHref(base, 'latest', 1)}>See latest</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href={newHref}>
                  <PenLine data-icon="inline-start" aria-hidden />
                  New thread
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <ThreadList items={data.items} showCategory={showCategory} />
          <Pager base={base} sort={sort} data={data} />
        </>
      )}
    </div>
  );
}
