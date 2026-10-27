// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { listHref, parseListParams, parseReportFilters, REPORT_SORTS } from '@/lib/forum/list-params';

describe('list params', () => {
  it('defaults and rejects junk', () => {
    expect(parseListParams({})).toEqual({ sort: 'latest', page: 1 });
    expect(parseListParams({ sort: 'drop table', page: '-3' })).toEqual({ sort: 'latest', page: 1 });
    expect(parseListParams({ sort: 'top', page: '2' })).toEqual({ sort: 'top', page: 2 });
    expect(parseListParams({ sort: ['new', 'top'], page: 'abc' })).toEqual({ sort: 'new', page: 1 });
  });
  it('builds hrefs without defaults', () => {
    expect(listHref('/forum', 'latest', 1)).toBe('/forum');
    expect(listHref('/forum/c/x', 'top', 3)).toBe('/forum/c/x?sort=top&page=3');
  });
});

describe('report filters', () => {
  it('defaults to both kinds, active only, and rejects junk', () => {
    expect(parseReportFilters({})).toEqual({ kind: 'report', status: 'active' });
    expect(parseReportFilters({ kind: 'discussion', status: 'x' })).toEqual({ kind: 'report', status: 'active' });
    expect(parseReportFilters({ kind: 'bug', status: 'closed' })).toEqual({ kind: 'bug', status: 'closed' });
    expect(parseListParams({ sort: 'votes' }, REPORT_SORTS).sort).toBe('votes');
    expect(parseListParams({ sort: 'unanswered' }, REPORT_SORTS).sort).toBe('latest');
  });
  it('keeps filters in hrefs, leaving out defaults', () => {
    expect(listHref('/forum/reports', 'latest', 1, { kind: 'report', status: 'active' })).toBe('/forum/reports');
    expect(listHref('/forum/reports', 'votes', 2, { kind: 'bug', status: 'all' })).toBe('/forum/reports?kind=bug&status=all&sort=votes&page=2');
  });
});
