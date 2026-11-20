import { describe, it, expect } from 'vitest';
import { confusionMatrix, macroF1, perClassMetrics } from '../src/eval-metrics';

describe('perClassMetrics', () => {
  it('computes precision, recall, f1 and support per class', () => {
    const expected = ['a', 'a', 'a', 'b', 'b', 'c'];
    const predicted = ['a', 'a', 'b', 'b', 'b', 'a'];
    const perClass = perClassMetrics(expected, predicted);
    expect(perClass['a']).toEqual({ support: 3, precision: 2 / 3, recall: 2 / 3, f1: 2 / 3 });
    expect(perClass['b']).toEqual({ support: 2, precision: 2 / 3, recall: 1, f1: 0.8 });
    expect(perClass['c']).toEqual({ support: 1, precision: 0, recall: 0, f1: 0 });
  });

  it('counts a predicted class that is never expected with zero support and zero recall', () => {
    const perClass = perClassMetrics(['a'], ['b']);
    expect(perClass['b']).toEqual({ support: 0, precision: 0, recall: 0, f1: 0 });
  });

  it('returns an empty record when there are no predictions and no expectations', () => {
    expect(perClassMetrics([], [])).toEqual({});
  });
});

describe('macroF1', () => {
  it('averages per-class f1 across classes', () => {
    const perClass = perClassMetrics(['a', 'a', 'b', 'b'], ['a', 'b', 'b', 'b']);
    // a: p=1, r=0.5, f1=2/3; b: p=2/3, r=1, f1=0.8 -> macro = (2/3 + 0.8) / 2
    expect(macroF1(perClass)).toBeCloseTo((2 / 3 + 0.8) / 2, 12);
  });

  it('returns 0 instead of NaN when there are no classes', () => {
    expect(macroF1({})).toBe(0);
  });
});

describe('confusionMatrix', () => {
  it('builds a square matrix over the sorted label union', () => {
    const { labels, matrix } = confusionMatrix(['b', 'a'], ['a', 'a']);
    expect(labels).toEqual(['a', 'b']);
    expect(matrix).toEqual([
      [1, 0],
      [1, 0],
    ]);
  });

  it('never divides by zero or produces NaN', () => {
    const { matrix } = confusionMatrix(['a'], ['b']);
    expect(JSON.stringify(matrix)).not.toContain('NaN');
  });
});
