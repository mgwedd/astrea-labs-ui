import Link from 'next/link';
import { Avatar, AvatarFallback, Empty, cn } from '@astrea/ui';
import { formatUtc } from '@/lib/admin/format';
import type { listApplications } from '@/lib/beta-access/service';

type Row = Awaited<ReturnType<typeof listApplications>>[number];

const initials = (r: Row) =>
  (r.fullName || r.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

/** The review list: one link per application, the selected one highlighted. */
export function ApplicationList({ rows, selectedId, empty }: { rows: Row[]; selectedId?: string; empty: string }) {
  if (rows.length === 0) return <Empty title={empty} />;
  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/admin/applications/${r.id}`}
            aria-current={r.id === selectedId ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 border-b border-l-2 border-l-transparent px-4 py-3 hover:bg-muted/50',
              r.id === selectedId && 'border-l-foreground bg-muted/50',
            )}
          >
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{initials(r)}</AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{r.fullName || r.email}</span>
              <span className="truncate text-xs text-muted-foreground">{r.fullName ? r.email : 'No name given'}</span>
            </span>
            <span className="whitespace-nowrap text-xs text-muted-foreground">{formatUtc(r.createdAt).slice(0, 10)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
