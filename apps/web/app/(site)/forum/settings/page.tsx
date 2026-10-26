import type { Metadata } from 'next';
import { SettingsForm } from '@/components/forum/settings-form';
import { requireForumMember } from '@/lib/forum/gate';
import { forumDeps } from '@/lib/forum/server';
import { getOwnProfile } from '@/lib/forum/service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Profile and identity · Forum', robots: { index: false, follow: false } };

export default async function ForumSettingsPage() {
  const viewer = await requireForumMember('/forum/settings');
  const profile = await getOwnProfile(forumDeps(), viewer);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile and identity</h1>
      <SettingsForm key={`${profile.username}:${profile.displayMode}`} profile={profile} />
    </div>
  );
}
