import type { BeforeSendEvent } from '@vercel/analytics/next';

// Paths that never reach Vercel Web Analytics. Beta pages carry single-use
// tokens in their query strings; admin pages carry application ids.
const EXCLUDED = [/^\/aletheia\/beta(\/|$)/, /^\/api\/beta(\/|$)/, /^\/admin(\/|$)/];

/**
 * Analytics `beforeSend`: drops events for excluded paths and removes the query
 * string and fragment from every other URL, so a token in a link is never sent.
 */
export function filterAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  let url: URL;
  try {
    url = new URL(event.url, 'https://astrealabs.com');
  } catch {
    return null;
  }
  if (EXCLUDED.some((re) => re.test(url.pathname))) return null;
  url.search = '';
  url.hash = '';
  return { ...event, url: url.toString() };
}
