import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ThreadListView } from '@/components/forum/thread-list-view';
import { requireForumMember } from '@/lib/forum/gate';
import { parseListParams } from '@/lib/forum/list-params';
import { forumDeps } from '@/lib/forum/server';
import { ForumError, listCategories, listThreads } from '@/lib/forum/service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Forum', robots: { index: false, follow: false } };

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const viewer = await requireForumMember(`/forum/c/${slug}`);
  const deps = forumDeps();
  const { sort, page } = parseListParams(await searchParams);
  const category = (await listCategories(deps)).find((c) => c.slug === slug);
  if (!category) notFound();
  try {
    const data = await listThreads(deps, viewer, { categorySlug: slug, sort, page });
    return <ThreadListView title={category.name} base={`/forum/c/${slug}`} sort={sort} data={data} showCategory={false} categorySlug={slug} />;
  } catch (e) {
    if (e instanceof ForumError && e.code === 'not_found') notFound();
    throw e;
  }
}
