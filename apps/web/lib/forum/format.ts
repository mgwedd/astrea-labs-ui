// Display helpers for forum pages. Pure, so they can run on the server and be tested.

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400_000],
  ['month', 30 * 86_400_000],
  ['week', 7 * 86_400_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "3 hours ago", "yesterday", "just now". */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diff = date.getTime() - now.getTime();
  if (Math.abs(diff) < 60_000) return 'just now';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, ms] of UNITS) if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  return 'just now';
}

/** A stable full date for tooltips and `<time title>`. UTC, so server and client agree. */
export const fullDate = (date: Date): string =>
  new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date) + ' UTC';

/** One or two capital letters for an avatar fallback. */
export const initialsOf = (name: string): string => name.replace(/[^a-z0-9]+/gi, ' ').trim().split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
