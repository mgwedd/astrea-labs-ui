import Link from 'next/link';
import { Button, cn } from '@astrea/ui';
import { APPLICATION_STATUSES, type ApplicationStatus } from '@/lib/admin/review-lists';

/** Status filter tabs for the applications board. Links, so each state is a URL. */
export function StatusNav({ status, counts }: { status: ApplicationStatus; counts?: Partial<Record<ApplicationStatus, number>> }) {
  return (
    <nav aria-label="Application status" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {APPLICATION_STATUSES.map((s) => (
        <Button
          key={s}
          asChild
          size="sm"
          variant="ghost"
          className={cn(
            'text-muted-foreground hover:bg-background/50 hover:text-foreground',
            s === status && 'bg-background text-foreground shadow-sm hover:bg-background',
          )}
        >
          <Link href={`/admin/applications?status=${s}`} aria-current={s === status ? 'page' : undefined} className="capitalize">
            {s}
            {counts?.[s] ? <span className="text-xs text-muted-foreground">{counts[s]}</span> : null}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
