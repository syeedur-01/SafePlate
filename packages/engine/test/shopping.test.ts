import { describe, it, expect } from 'vitest';
import { makeDish } from '@sp/contracts/testing';
import { buildShoppingList } from '../src/shopping';

const l = (id: string, g: number) => ({
  ingredient_id: id,
  grams_raw: g,
  quantity_basis: 'ESTIMATE' as const,
});
const d = makeDish({
  id: 'd',
  ingredients: [l('rice', 100), l('water', 300), l('salt', 2.55), l('oil', 100)],
}) as never;
describe('buildShoppingList', () => {
  it('scales by servings, drops water, sorts by grams then id', () => {
    expect(buildShoppingList(d, 2)).toEqual([
      { ingredientId: 'oil', grams: 200 },
      { ingredientId: 'rice', grams: 200 },
      { ingredientId: 'salt', grams: 5.1 },
    ]);
  });
  it('rejects bad servings', () => {
    for (const n of [0, 21, 1.5, -1]) expect(() => buildShoppingList(d, n)).toThrow(RangeError);
  });
});
