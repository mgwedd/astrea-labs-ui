import { Skeleton } from '@astrea/ui';

export default function ThreadLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-3/4" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
