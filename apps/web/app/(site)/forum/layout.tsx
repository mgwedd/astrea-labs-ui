import { requireForumMember } from '@/lib/forum/gate';
import { forumDeps } from '@/lib/forum/server';
import { getOwnProfile, listCategories } from '@/lib/forum/service';
import { ConfirmBanner } from '@/components/forum/confirm-banner';
import { ForumShell } from '@/components/forum/forum-shell';

export const dynamic = 'force-dynamic';

export default async function ForumLayout({ children }: { children: React.ReactNode }) {
  // The layout gate does not protect actions or pages on its own; each page and action calls it too.
  const viewer = await requireForumMember();
  const deps = forumDeps();
  const [categories, profile] = await Promise.all([listCategories(deps), getOwnProfile(deps, viewer)]);
  return (
    <ForumShell categories={categories} isAdmin={viewer.isAdmin}>
      {!profile.usernameConfirmed && <ConfirmBanner username={profile.username} />}
      {children}
    </ForumShell>
  );
}
