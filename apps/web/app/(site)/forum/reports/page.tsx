import type { Metadata } from 'next';
import Link from 'next/link';
import { Bug, Lightbulb } from 'lucide-react';
import { Button, Empty } from '@astrea/ui';
import { Pager, SortTabs, ThreadList } from '@/components/forum/thread-list';
import { requireForumMember } from '@/lib/forum/gate';
import { listHref, parseListParams, parseReportFilters, REPORT_SORTS, type KindFilter, type ReportStatusFilter } from '@/lib/forum/list-params';
import { forumDeps } from '@/lib/forum/server';
import { listThreads } from '@/lib/forum/service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Bugs and requests · Forum', robots: { index: false, follow: false } };

const BASE = '/forum/reports';
const KINDS: { value: KindFilter; label: string }[] = [
  { value: 'report', label: 'All' },
  { value: 'bug', label: 'Bugs' },
  { value: 'feature', label: 'Features' },
];
const STATUSES: { value: ReportStatusFilter; label: string }[] = [
  { value: 'active', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];

function Filter<T extends string>({ label, options, current, href }: { label: string; options: { value: T; label: string }[]; current: T; href: (v: T) => string }) {
  return (
    <nav aria-label={label} className="inline-flex rounded-md border p-0.5">
      {options.map((o) => (
        <Button key={o.value} asChild size="sm" variant={o.value === current ? 'secondary' : 'ghost'} className="h-7">
          <Link href={href(o.value)} aria-current={o.value === current ? 'page' : undefined}>
            {o.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireForumMember(BASE);
  const raw = await searchParams;
  const { sort, page } = parseListParams(raw, REPORT_SORTS);
  const filters = parseReportFilters(raw);
  const data = await listThreads(forumDeps(), viewer, { kind: filters.kind, status: filters.status === 'all' ? undefined : filters.status, sort, page });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Bugs and requests</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/forum/new?kind=bug">
              <Bug data-icon="inline-start" aria-hidden />
              Report a bug
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/forum/new?kind=feature">
              <Lightbulb data-icon="inline-start" aria-hidden />
              Request a feature
            </Link>
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Filter label="Type" options={KINDS} current={filters.kind} href={(kind) => listHref(BASE, sort, 1, { ...filters, kind })} />
          <Filter label="Status" options={STATUSES} current={filters.status} href={(status) => listHref(BASE, sort, 1, { ...filters, status })} />
        </div>
        <SortTabs base={BASE} sort={sort} sorts={REPORT_SORTS} filters={filters} />
      </div>
      {data.items.length === 0 ? (
        <Empty
          icon={Bug}
          title={filters.status === 'closed' ? 'Nothing closed yet' : 'Nothing reported'}
          description={filters.status === 'closed' ? 'Fixed, shipped, declined and duplicate reports show up here.' : 'Found a bug or want something added? Start a report.'}
        />
      ) : (
        <>
          <ThreadList items={data.items} showCategory />
          <Pager base={BASE} sort={sort} data={data} filters={filters} />
        </>
      )}
    </div>
  );
}
