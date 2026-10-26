import Link from 'next/link';
import { Badge, Empty, Input, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@astrea/ui';
import { projects } from '@astrea/research-registry';
import { StatusNav } from '@/components/admin/applications/status-nav';
import { Notice } from '@/components/admin/notice';
import { formatUtc } from '@/lib/admin/format';
import { filterApplications, parseStatus } from '@/lib/admin/review-lists';
import { requireAdmin } from '@/lib/admin/gate';
import { listApplications } from '@/lib/beta-access/service';
import { getDb } from '@/lib/licensing/db/client';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The beta program is Aletheia's; the registry is the source for its name.
const projectName = projects.find((p) => p.slug === 'aletheia')?.name ?? 'Aletheia';

export default async function ApplicationsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const status = parseStatus(params.status);
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';

  const all = await listApplications({ db: getDb() }, status);
  const rows = filterApplications(all, q);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Beta applications</h1>
        <p className="text-sm text-muted-foreground">Approve after a license check. Approving issues a license and emails the key link.</p>
      </div>
      <Notice value={params.notice} />

      <div className="flex flex-wrap items-center gap-3">
        <StatusNav status={status} />
        <form method="get" action="/admin/applications" className="flex flex-1 basis-64 gap-2">
          <input type="hidden" name="status" value={status} />
          <Input name="q" defaultValue={q} placeholder="Filter by email or name" aria-label="Filter applications" />
          <Button type="submit" variant="outline">
            Filter
          </Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <Empty title={q ? `No ${status} applications match “${q}”` : `No ${status} applications`} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="max-w-72">
                  <Link href={`/admin/applications/${a.id}`} className="flex flex-col underline-offset-4 hover:underline">
                    <span className="truncate font-medium">{a.fullName || '(no name)'}</span>
                    <span className="truncate text-xs text-muted-foreground">{a.email}</span>
                  </Link>
                </TableCell>
                <TableCell>{projectName}</TableCell>
                <TableCell className="whitespace-nowrap">{formatUtc(a.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {a.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {all.length === 500 && <p className="text-sm text-muted-foreground">Showing the newest 500.</p>}
    </div>
  );
}
