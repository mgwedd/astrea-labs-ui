import Link from 'next/link';
import { CheckCircle2, Eye, Lock, MessageSquare, Pin } from 'lucide-react';
import { Badge, Button, cn } from '@astrea/ui';
import { relativeTime } from '@/lib/forum/format';
import { listHref, SORTS } from '@/lib/forum/list-params';
import type { Page, ThreadSort, ThreadSummary } from '@/lib/forum/service';
import { AuthorName } from './author-name';

export function SortTabs({ base, sort }: { base: string; sort: ThreadSort }) {
  return (
    <nav aria-label="Sort threads" className="flex flex-wrap gap-1">
      {SORTS.map((s) => (
        <Button key={s.value} asChild size="sm" variant={s.value === sort ? 'secondary' : 'ghost'}>
          <Link href={listHref(base, s.value, 1)} aria-current={s.value === sort ? 'page' : undefined}>
            {s.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}

export function Pager({ base, sort, data }: { base: string; sort: ThreadSort; data: Page<unknown> }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 pt-4">
      <Button asChild variant="outline" size="sm" className={cn(data.page <= 1 && 'pointer-events-none opacity-50')} aria-disabled={data.page <= 1}>
        <Link href={listHref(base, sort, data.page - 1)} tabIndex={data.page <= 1 ? -1 : undefined}>
          Previous
        </Link>
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {data.page} of {pages}
      </span>
      <Button asChild variant="outline" size="sm" className={cn(data.page >= pages && 'pointer-events-none opacity-50')} aria-disabled={data.page >= pages}>
        <Link href={listHref(base, sort, data.page + 1)} tabIndex={data.page >= pages ? -1 : undefined}>
          Next
        </Link>
      </Button>
    </nav>
  );
}

/** Thread rows. Views appear only when the service gave them (admin viewers). */
export function ThreadList({ items, showCategory }: { items: ThreadSummary[]; showCategory: boolean }) {
  const now = new Date();
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border">
      {items.map((t) => (
        <li key={t.id} className="flex items-start gap-3 p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {t.hasNew && (
                <span className="inline-flex" title="New activity since your last visit">
                  <span className="size-2 rounded-full bg-primary" aria-hidden />
                  <span className="sr-only">New activity since your last visit</span>
                </span>
              )}
              <Link href={`/forum/t/${t.id}`} className="font-medium leading-snug hover:underline">
                {t.title}
              </Link>
              {t.pinned && (
                <Badge variant="outline" className="gap-1">
                  <Pin className="size-3" aria-hidden />
                  Pinned
                </Badge>
              )}
              {t.answered && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="size-3" aria-hidden />
                  Answered
                </Badge>
              )}
              {t.locked && (
                <Badge variant="outline" className="gap-1">
                  <Lock className="size-3" aria-hidden />
                  Locked
                </Badge>
              )}
            </div>
            {t.excerpt && <p className="line-clamp-2 text-sm text-muted-foreground">{t.excerpt}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {showCategory && (
                <Link href={`/forum/c/${t.category.slug}`} className="hover:text-foreground hover:underline">
                  {t.category.name}
                </Link>
              )}
              {t.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="font-normal">
                  {tag}
                </Badge>
              ))}
              <span className="inline-flex items-center gap-1">
                <AuthorName author={t.author} className="font-normal" />
              </span>
              <time dateTime={t.lastActivityAt.toISOString()}>{relativeTime(t.lastActivityAt, now)}</time>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1" title={`${t.replyCount} ${t.replyCount === 1 ? 'reply' : 'replies'}`}>
              <MessageSquare className="size-3.5" aria-hidden />
              <span className="tabular-nums">{t.replyCount}</span>
              <span className="sr-only">{t.replyCount === 1 ? 'reply' : 'replies'}</span>
            </span>
            {t.views !== undefined && (
              <span className="inline-flex items-center gap-1" title="Views (admins only)">
                <Eye className="size-3.5" aria-hidden />
                <span className="tabular-nums">{t.views}</span>
                <span className="sr-only">views</span>
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
