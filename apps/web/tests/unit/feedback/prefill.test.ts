import { describe, expect, it } from 'vitest';
import { prefillFrom } from '@/lib/feedback/prefill';

describe('prefillFrom', () => {
  it('reads project, type and environment from the app link', () => {
    expect(prefillFrom({ project: 'aletheia', type: 'bug', environment: 'Aletheia 0.9.2 · macOS 15.1' })).toEqual({
      project: 'aletheia',
      type: 'bug',
      environment: 'Aletheia 0.9.2 · macOS 15.1',
    });
  });

  it('drops unknown values', () => {
    expect(prefillFrom({ project: 'nope', type: 'question' })).toEqual({});
    expect(prefillFrom({ project: 'elenchos' })).toEqual({}); // private repo, not offered
  });

  it('takes the first of repeated params, strips control characters and caps length', () => {
    expect(prefillFrom({ type: ['feature', 'bug'] })).toEqual({ type: 'feature' });
    expect(prefillFrom({ environment: 'a\nb' })).toEqual({ environment: 'a b' });
    expect(prefillFrom({ environment: 'x'.repeat(500) }).environment).toHaveLength(200);
    expect(prefillFrom({ environment: '   ' })).toEqual({});
  });
});
