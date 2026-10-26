import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ThreadView, type PostVM, type ThreadVM } from '@/components/forum/thread-view';
import { plainText } from '@/lib/forum/content';
import { fullDate, relativeTime } from '@/lib/forum/format';
import { requireForumMember } from '@/lib/forum/gate';
import { forumDeps } from '@/lib/forum/server';
import { getOwnProfile, getThread, recordView, REACTION_EMOJI } from '@/lib/forum/service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Thread · Forum', robots: { index: false, follow: false } };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireForumMember(`/forum/t/${id}`);
  const deps = forumDeps();
  const [t, profile] = await Promise.all([getThread(deps, viewer, id), getOwnProfile(deps, viewer)]);
  if (!t) notFound();
  // Count the view after reading, so "new since your last visit" reflects the previous visit.
  await recordView(deps, viewer, id);

  const now = new Date();
  const when = (d: Date) => ({ when: relativeTime(d, now), whenTitle: fullDate(d) });
  const seen = t.viewerLastViewedAt;
  let newShown = false;
  const posts: PostVM[] = t.posts.map((p) => {
    const quoted = p.quotePostId ? t.posts.find((q) => q.id === p.quotePostId) : undefined;
    const isNew = seen !== null && !p.author.mine && p.createdAt.getTime() > seen.getTime();
    const firstNew = isNew && !newShown;
    if (isNew) newShown = true;
    return {
      id: p.id,
      author: p.author,
      bodyHtml: p.bodyHtml,
      excerpt: plainText(p.bodyHtml).slice(0, 140),
      ...when(p.createdAt),
      isSolution: p.isSolution,
      firstNew,
      quote: quoted ? { id: quoted.id, author: quoted.author.name, excerpt: plainText(quoted.bodyHtml).slice(0, 160) } : null,
      reactions: p.reactions,
    };
  });

  const replyBlocked: ThreadVM['replyBlocked'] = !profile.usernameConfirmed ? 'unconfirmed' : t.locked && !viewer.isAdmin ? 'locked' : null;
  const vm: ThreadVM = {
    id: t.id,
    title: t.title,
    category: { slug: t.category.slug, name: t.category.name },
    tags: t.tags,
    pinned: t.pinned,
    locked: t.locked,
    answered: t.answered,
    bookmarked: t.bookmarked,
    isAdmin: viewer.isAdmin,
    views: t.views,
    viewers: t.viewers,
    op: { author: t.author, bodyHtml: t.bodyHtml, ...when(t.createdAt), reactions: t.reactions },
    posts,
    canReply: replyBlocked === null,
    replyBlocked,
    username: profile.username,
    emoji: [...REACTION_EMOJI],
  };
  return <ThreadView thread={vm} />;
}
