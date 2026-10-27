'use client';

import { Analytics } from '@vercel/analytics/next';
import { filterAnalyticsEvent } from '@/lib/analytics-filter';

/** Vercel Web Analytics, with beta, API and admin pages left out and query strings removed. */
export function SiteAnalytics() {
  return <Analytics beforeSend={filterAnalyticsEvent} />;
}
