import { OverviewSkeleton } from '@/components/admin/skeletons';

// Shown on a cold load while the admin layout checks the session and loads nav counts.
export default function Loading() {
  return (
    <main className="p-4 sm:p-6">
      <OverviewSkeleton />
    </main>
  );
}
