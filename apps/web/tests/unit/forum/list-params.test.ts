// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { listHref, parseListParams } from '@/lib/forum/list-params';

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
