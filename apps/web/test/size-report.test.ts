import { describe, it, expect } from 'vitest';
import { summarizeSizes, withinBudget } from '../src/lib/size-report';

describe('size report', () => {
  it('sums and prints sizes', () => {
    const r = summarizeSizes([
      { file: 'a.js', gzipBytes: 1000 },
      { file: 'b.js', gzipBytes: 2500 },
    ]);
    expect(r.total).toBe(3500);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toContain('a.js');
  });
  it('compares to a budget inclusively', () => {
    expect(withinBudget(100, 100)).toBe(true);
    expect(withinBudget(101, 100)).toBe(false);
  });
});
