import type { ThreadSort } from './service';

export const SORTS: { value: ThreadSort; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'new', label: 'New' },
  { value: 'top', label: 'Top' },
  { value: 'unanswered', label: 'Unanswered' },
];

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** `?sort=` and `?page=` from a page's searchParams, with safe defaults. */
export function parseListParams(raw: Raw): { sort: ThreadSort; page: number } {
  const sort = SORTS.find((s) => s.value === one(raw.sort))?.value ?? 'latest';
  const page = Math.floor(Number(one(raw.page)));
  return { sort, page: Number.isFinite(page) && page >= 1 && page <= 10_000 ? page : 1 };
}

/** A list URL with its query, leaving out defaults. */
export function listHref(base: string, sort: ThreadSort, page: number): string {
  const q = new URLSearchParams();
  if (sort !== 'latest') q.set('sort', sort);
  if (page > 1) q.set('page', String(page));
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
