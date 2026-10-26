// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { acceptanceFrom } from '@/lib/licensing/acceptance';
import type { AcceptedDoc, ConsentRecord } from '@/lib/licensing/db/schema';

const h1 = 'a'.repeat(64);
const h2 = 'b'.repeat(64);
const accepted: AcceptedDoc[] = [
  { d: 'privacy', v: '2026-10-25', h: h2 },
  { d: 'terms', v: '2026-10-25', h: h1 },
];
const block = (id: string, tickedAt: string): ConsentRecord => ({ id, version: 'x', sha256: 'c'.repeat(64), tickedAt });

describe('acceptanceFrom', () => {
  it('builds acc from the stored record and the C1 tick time', () => {
    const at = Date.parse('2026-10-25T10:00:00.000Z') / 1000;
    expect(acceptanceFrom([block('B0', '2026-10-25T09:00:00.000Z'), block('C1', '2026-10-25T10:00:00.000Z')], accepted)).toEqual([
      { d: 'terms', v: '2026-10-25', h: h1, at },
      { d: 'privacy', v: '2026-10-25', h: h2, at },
    ]);
  });

  it('yields nothing for a row without a stored record', () => {
    expect(acceptanceFrom([block('C1', '2026-10-25T10:00:00.000Z')], null)).toEqual([]);
  });

  it('yields nothing without a usable C1 tick', () => {
    expect(acceptanceFrom([block('B0', '2026-10-25T10:00:00.000Z')], accepted)).toEqual([]);
    expect(acceptanceFrom([block('C1', '')], accepted)).toEqual([]);
  });
});
