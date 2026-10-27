import { describe, expect, it } from 'vitest';
import { filterAnalyticsEvent } from '@/lib/analytics-filter';

const pageview = (url: string) => ({ type: 'pageview' as const, url });

describe('filterAnalyticsEvent', () => {
  it.each([
    'https://astrealabs.com/aletheia/beta',
    'https://astrealabs.com/aletheia/beta/apply',
    'https://astrealabs.com/aletheia/beta/sign?t=secret',
    'https://astrealabs.com/aletheia/beta/key?t=secret',
    'https://astrealabs.com/aletheia/beta/signed',
    'https://astrealabs.com/api/beta/document',
    'https://astrealabs.com/admin/applications/1234',
  ])('drops %s', (url) => {
    expect(filterAnalyticsEvent(pageview(url))).toBeNull();
    expect(filterAnalyticsEvent({ type: 'event', url })).toBeNull();
  });

  it('keeps other pages and removes the query string and fragment', () => {
    expect(filterAnalyticsEvent(pageview('https://astrealabs.com/feedback/confirm?t=secret#x'))).toEqual(
      pageview('https://astrealabs.com/feedback/confirm'),
    );
    expect(filterAnalyticsEvent(pageview('https://astrealabs.com/projects/aletheia'))).toEqual(
      pageview('https://astrealabs.com/projects/aletheia'),
    );
  });

  it('does not treat lookalike paths as beta pages', () => {
    expect(filterAnalyticsEvent(pageview('https://astrealabs.com/aletheia/betamax'))).not.toBeNull();
    expect(filterAnalyticsEvent(pageview('https://astrealabs.com/aletheia/download'))).not.toBeNull();
  });

  it('drops events with an unparseable url', () => {
    expect(filterAnalyticsEvent(pageview('http://'))).toBeNull();
  });
});
