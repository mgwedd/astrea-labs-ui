import type { Metadata } from 'next';
import { ComposeForm } from '@/components/forum/compose-form';
import { ConfirmGate } from '@/components/forum/confirm-gate';
import { requireForumMember } from '@/lib/forum/gate';
import { forumDeps } from '@/lib/forum/server';
import { getOwnProfile, listCategories } from '@/lib/forum/service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New thread · Forum', robots: { index: false, follow: false } };

export default async function NewThreadPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireForumMember('/forum/new');
  const deps = forumDeps();
  const sp = await searchParams;
  const raw = sp.category;
  const k = Array.isArray(sp.kind) ? sp.kind[0] : sp.kind;
  const initialKind = k === 'bug' || k === 'feature' ? k : 'discussion';
  const [categories, profile] = await Promise.all([listCategories(deps), getOwnProfile(deps, viewer)]);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">New thread</h1>
      {profile.usernameConfirmed ? (
        <ComposeForm categories={categories} initialCategory={Array.isArray(raw) ? raw[0] : raw} initialKind={initialKind} />
      ) : (
        <ConfirmGate username={profile.username} />
      )}
    </div>
  );
}
