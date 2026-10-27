import type { StatusFilter, ThreadSort } from './service';

export const SORTS: { value: ThreadSort; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'new', label: 'New' },
  { value: 'top', label: 'Top' },
  { value: 'unanswered', label: 'Unanswered' },
];

/** Sorts on the bug reports and feature requests list. */
export const REPORT_SORTS: { value: ThreadSort; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'votes', label: 'Most votes' },
  { value: 'new', label: 'New' },
];

/** `report` = bugs and features together. */
export type KindFilter = 'report' | 'bug' | 'feature';
/** `all` shows closed reports too. */
export type ReportStatusFilter = StatusFilter | 'all';

export type ListFilters = { kind?: KindFilter; status?: ReportStatusFilter };

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** `?sort=` and `?page=` from a page's searchParams, with safe defaults. `sorts` limits the allowed sorts. */
export function parseListParams(raw: Raw, sorts = SORTS): { sort: ThreadSort; page: number } {
  const sort = sorts.find((s) => s.value === one(raw.sort))?.value ?? 'latest';
  const page = Math.floor(Number(one(raw.page)));
  return { sort, page: Number.isFinite(page) && page >= 1 && page <= 10_000 ? page : 1 };
}

/** `?kind=` and `?status=` for the reports list. Defaults: both kinds, active only. */
export function parseReportFilters(raw: Raw): { kind: KindFilter; status: ReportStatusFilter } {
  const k = one(raw.kind);
  const st = one(raw.status);
  return {
    kind: k === 'bug' || k === 'feature' ? k : 'report',
    status: st === 'closed' || st === 'all' ? st : 'active',
  };
}

/** A list URL with its query, leaving out defaults. */
export function listHref(base: string, sort: ThreadSort, page: number, filters: ListFilters = {}): string {
  const q = new URLSearchParams();
  if (filters.kind && filters.kind !== 'report') q.set('kind', filters.kind);
  if (filters.status && filters.status !== 'active') q.set('status', filters.status);
  if (sort !== 'latest') q.set('sort', sort);
  if (page > 1) q.set('page', String(page));
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
