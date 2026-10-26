import { describe, expect, it } from 'vitest';
import { toPrefs } from '@/lib/email/preferences';

describe('email preferences defaults', () => {
  it('are both off when the user has no saved choice', () => {
    expect(toPrefs(undefined)).toEqual({ product: false, news: false });
    expect(toPrefs(null)).toEqual({ product: false, news: false });
  });

  it('follow the opt-in timestamps', () => {
    expect(toPrefs({ productOptInAt: new Date(), newsOptInAt: null })).toEqual({ product: true, news: false });
  });
});
