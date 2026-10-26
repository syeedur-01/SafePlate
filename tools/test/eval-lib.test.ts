import { describe, it, expect } from 'vitest';
import { dishMetrics, labelMetrics, type EvalItem } from '../src/eval-lib';

const d = (file: string, id: string): EvalItem => ({
  file,
  kind: 'dish',
  split: 'dev',
  expectedDishId: id,
});

describe('dishMetrics', () => {
  const items = [d('1', 'a'), d('2', 'b'), d('3', 'c'), d('4', 'd')];
  const preds = [
    { file: '1', candidates: [{ dishId: 'a' }] },
    { file: '2', candidates: [{ dishId: 'x' }, { dishId: 'b' }] },
    { file: '3', candidates: [{ dishId: null }] },
  ];
  it('computes top1, top3, unknown rate; a missing prediction is a miss', () => {
    expect(dishMetrics(items, preds)).toEqual({ n: 4, top1: 0.25, top3: 0.5, unknownRate: 0.25 });
  });
  it('returns zeros, not NaN, for no items', () => {
    expect(dishMetrics([], [])).toEqual({ n: 0, top1: 0, top3: 0, unknownRate: 0 });
  });
});

describe('labelMetrics', () => {
  const items: EvalItem[] = [
    {
      file: 'l1',
      kind: 'label',
      split: 'dev',
      expectedAllergens: ['milk', 'egg'],
      expectedExpiry: '2026-12-01',
    },
  ];
  it('computes precision, recall and expiry exactness', () => {
    const m = labelMetrics(items, [
      { file: 'l1', declaredAllergens: ['milk', 'fish'], expiryDate: '2026-12-01' },
    ]);
    expect(m).toEqual({ n: 1, allergenPrecision: 0.5, allergenRecall: 0.5, expiryExact: 1 });
  });
});
