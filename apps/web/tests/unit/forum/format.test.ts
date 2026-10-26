// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fullDate, initialsOf, relativeTime } from '@/lib/forum/format';

const now = new Date('2026-06-10T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('format', () => {
  it('describes time relative to now', () => {
    expect(relativeTime(ago(10_000), now)).toBe('just now');
    expect(relativeTime(ago(5 * 60_000), now)).toBe('5 minutes ago');
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe('3 hours ago');
    expect(relativeTime(ago(86_400_000), now)).toBe('yesterday');
    expect(relativeTime(ago(14 * 86_400_000), now)).toBe('2 weeks ago');
    expect(relativeTime(ago(400 * 86_400_000), now)).toBe('last year');
  });
  it('formats a stable UTC date', () => {
    expect(fullDate(new Date('2026-06-10T12:05:00Z'))).toBe('Jun 10, 2026, 12:05 PM UTC');
  });
  it('makes initials', () => {
    expect(initialsOf('dancing-stark')).toBe('DS');
    expect(initialsOf('mike')).toBe('M');
    expect(initialsOf('--')).toBe('?');
  });
});
