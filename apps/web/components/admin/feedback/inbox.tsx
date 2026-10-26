import Link from 'next/link';
import { Flag } from 'lucide-react';
import { Badge, Button, Item, ItemContent, ItemDescription, ItemTitle, cn } from '@astrea/ui';
import { FEEDBACK_STATUSES, type FeedbackStatus } from '@/lib/feedback/db/schema';
import { FEEDBACK_PROJECTS } from '@/lib/feedback/projects';
import type { PublicSubmission } from '@/lib/feedback/service';

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  pending_review: 'To review',
  approved: 'On GitHub',
  rejected: 'Rejected',
  unconfirmed: 'Awaiting confirmation',
  creating: 'Creating issue',
};
const TABS: FeedbackStatus[] = ['pending_review', 'approved', 'rejected', 'unconfirmed'];

export type InboxQuery = { status: FeedbackStatus; type?: 'bug' | 'feature'; project?: string };

/** Reads ?status=&type=&project= from the page's search params; unknown values fall back to the defaults. */
export function parseInboxQuery(params: Record<string, string | string[] | undefined>): InboxQuery {
  return {
    status: FEEDBACK_STATUSES.find((s) => s === params.status) ?? 'pending_review',
    type: params.type === 'bug' || params.type === 'feature' ? params.type : undefined,
    project: FEEDBACK_PROJECTS.find((p) => p.slug === params.project)?.slug,
  };
}

export function inboxHref(q: InboxQuery, change: Partial<InboxQuery> = {}, id?: string): string {
  const next = { ...q, ...change };
  const qs = new URLSearchParams({ status: next.status });
  if (next.type) qs.set('type', next.type);
  if (next.project) qs.set('project', next.project);
  return `/admin/feedback${id ? `/${id}` : ''}?${qs}`;
}

function age(date: Date, now: number): string {
  const mins = Math.max(0, Math.round((now - date.getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h`;
  return `${Math.round(mins / (60 * 24))} d`;
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {children}
    </div>
  );
}

/** The queue: status tabs with counts, type and project filters, and one row per submission. */
export function Inbox({
  rows,
  counts,
  query,
  selectedId,
  className,
}: {
  rows: PublicSubmission[];
  counts: Record<FeedbackStatus, number>;
  query: InboxQuery;
  selectedId?: string;
  className?: string;
}) {
  const now = Date.now();
  const tabs = TABS.includes(query.status) ? TABS : [...TABS, query.status];
  return (
    <section aria-label="Feedback queue" className={cn('flex min-w-0 flex-col rounded-lg border', className)}>
      <div className="flex flex-col gap-2 border-b p-3">
        <nav aria-label="Feedback status">
          <FilterRow label="Status">
            {tabs.map((s) => (
              <Button key={s} asChild size="sm" variant={s === query.status ? 'secondary' : 'ghost'}>
                <Link href={inboxHref(query, { status: s })} aria-current={s === query.status ? 'page' : undefined}>
                  {STATUS_LABELS[s]}
                  <Badge variant="outline">{counts[s]}</Badge>
                </Link>
              </Button>
            ))}
          </FilterRow>
        </nav>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <FilterRow label="Type">
            {([undefined, 'bug', 'feature'] as const).map((t) => (
              <Button key={t ?? 'all'} asChild size="sm" variant={t === query.type ? 'secondary' : 'ghost'}>
                <Link href={inboxHref(query, { type: t })} aria-current={t === query.type ? 'true' : undefined} className="capitalize">
                  {t ?? 'All types'}
                </Link>
              </Button>
            ))}
          </FilterRow>
          {FEEDBACK_PROJECTS.length > 1 && (
            <FilterRow label="Project">
              {[undefined, ...FEEDBACK_PROJECTS.map((p) => p.slug)].map((slug) => (
                <Button key={slug ?? 'all'} asChild size="sm" variant={slug === query.project ? 'secondary' : 'ghost'}>
                  <Link href={inboxHref(query, { project: slug })} aria-current={slug === query.project ? 'true' : undefined}>
                    {slug ? (FEEDBACK_PROJECTS.find((p) => p.slug === slug)?.name ?? slug) : 'All projects'}
                  </Link>
                </Button>
              ))}
            </FilterRow>
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {rows.map((s) => (
            <li key={s.id}>
              <Item asChild size="sm" className={cn('rounded-none', s.id === selectedId && 'bg-muted')}>
                <Link href={inboxHref(query, {}, s.id)} aria-current={s.id === selectedId ? 'page' : undefined}>
                  <ItemContent>
                    <ItemTitle className="w-full justify-between">
                      <span className="min-w-0 break-words">{s.title}</span>
                      <span className="shrink-0 text-xs font-normal text-muted-foreground">{age(s.createdAt, now)}</span>
                    </ItemTitle>
                    <ItemDescription className="flex items-center gap-2">
                      <span className="capitalize">
                        {FEEDBACK_PROJECTS.find((p) => p.slug === s.projectSlug)?.name ?? s.projectSlug} · {s.type}
                      </span>
                      {s.flagged && (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <Flag className="size-3" aria-hidden />
                          Flagged
                        </span>
                      )}
                    </ItemDescription>
                  </ItemContent>
                </Link>
              </Item>
            </li>
          ))}
        </ul>
      )}
      {rows.length === 200 && <p className="border-t p-3 text-xs text-muted-foreground">Showing the newest 200.</p>}
    </section>
  );
}
