// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DOC_VERSION, documentBlocks, blockById } from '@/lib/beta-access/content';
import { consentRecords, documentBlockRecords, sha256Hex } from '@/lib/beta-access/hash';

const V = '2026-10-24';

describe('sha256Hex', () => {
  it('matches known vectors and treats strings as UTF-8', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('é')).toBe(sha256Hex(new TextEncoder().encode('é')));
  });
});

describe('documentBlockRecords', () => {
  it('covers every block in order with a stable hash of its text', () => {
    const records = documentBlockRecords(V);
    expect(records.map((r) => r.id)).toEqual(documentBlocks(V).map((b) => b.id));
    for (const r of records) {
      expect(r.version).toBe(DOC_VERSION);
      expect(r.sha256).toBe(sha256Hex(blockById(r.id, V).text));
      expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(documentBlockRecords(V)).toEqual(records);
  });
});

describe('C1 hash', () => {
  it('changes with the terms version, so ticks for another version are stale', () => {
    const c1 = (v: string) => documentBlockRecords(v).find((r) => r.id === 'C1')!.sha256;
    expect(c1('2026-10-24')).not.toBe(c1('2026-10-25'));
    expect(c1('2026-10-24')).toBe(sha256Hex(blockById('C1', '2026-10-24').text));
  });
});

describe('consentRecords', () => {
  it('returns ticked blocks in document order', () => {
    const records = consentRecords({ C2: '2026-10-23T10:00:02.000Z', B0: '2026-10-23T10:00:00.000Z' }, V);
    expect(records).toEqual([
      { id: 'B0', version: DOC_VERSION, sha256: sha256Hex(blockById('B0', V).text), tickedAt: '2026-10-23T10:00:00.000Z' },
      { id: 'C2', version: DOC_VERSION, sha256: sha256Hex(blockById('C2', V).text), tickedAt: '2026-10-23T10:00:02.000Z' },
    ]);
  });

  it('rejects unknown ids', () => {
    expect(() => consentRecords({ Z9: '2026-10-23T10:00:00.000Z' }, V)).toThrow();
  });
});
