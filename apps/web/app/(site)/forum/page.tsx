import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { requireForumMember } from '@/lib/forum/gate';
import { forumDeps } from '@/lib/forum/server';
import { listCategories } from '@/lib/forum/service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Forum', robots: { index: false, follow: false } };

// Placeholder until the forum UI lands; it only proves the gate and the data layer work.
export default async function ForumPage() {
  await requireForumMember();
  const categories = await listCategories(forumDeps());
  return (
    <div className="container max-w-2xl pb-16">
      <PageHeader eyebrow="Members" title="Forum" />
      <ul className="flex flex-col gap-2 text-sm">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            <span>{c.name}</span>
            <span className="text-muted-foreground">{c.threadCount} threads</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
