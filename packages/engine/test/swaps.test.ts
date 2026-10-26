import { describe, it, expect } from 'vitest';
import type { Dish, HealthRule } from '@sp/contracts';
import { makeDish, makeIngredient, makeProfile } from '@sp/contracts/testing';
import { suggestSwaps } from '../src/swaps';

const ing = new Map(
  [
    makeIngredient({ id: 'salty', sodium_mg: 1000 }),
    makeIngredient({ id: 'plain', sodium_mg: 100 }),
  ].map((i) => [i.id, i]),
);
const dish = (id: string, ingredient: string, grams: number, extra: object = {}) =>
  makeDish({
    id,
    ingredients: [{ ingredient_id: ingredient, grams_raw: grams, quantity_basis: 'ESTIMATE' }],
    ...extra,
  }) as unknown as Dish;
const rule: HealthRule = {
  kind: 'nutrient',
  id: 'htn',
  condition: 'hypertension',
  nutrient: 'sodium_mg',
  dailyLimit: 2000,
  cautionFraction: 0.3,
  avoidFraction: 0.6,
  messageKey: 'warn.sodium_high',
  sourceRef: 'S',
  status: 'draft',
};
const A = dish('a', 'salty', 100); // 1000 mg, 50 percent: caution
const B = dish('b', 'plain', 100, { allergens: ['milk'] }); // 100 mg, milk
const C = dish('c', 'salty', 50); // 500 mg, 50 percent lower
const D = dish('d', 'salty', 100, { allergens: ['milk'] }); // 1000 mg: no improvement
const profile = makeProfile({ conditions: ['hypertension'] });
const base = { dish: A, dishes: [A, B, C, D], ingredients: ing, rules: [rule] };

describe('suggestSwaps', () => {
  it('returns the best improvements first', () => {
    expect(suggestSwaps({ ...base, profile }).map((s) => s.dishId)).toEqual(['b', 'c']);
  });
  it('lists the improved nutrients and a reason key', () => {
    expect(suggestSwaps({ ...base, profile })[0]).toMatchObject({
      dishId: 'b',
      improves: ['sodium_mg'],
      reasonKey: 'swap.lower_nutrient',
    });
  });
  it('respects the limit', () => {
    expect(suggestSwaps({ ...base, profile, limit: 1 })).toHaveLength(1);
  });
  it('skips dishes with an allergen the user has', () => {
    expect(
      suggestSwaps({
        ...base,
        profile: makeProfile({ conditions: ['hypertension'], allergies: ['milk'] }),
      }).map((s) => s.dishId),
    ).toEqual(['c']);
  });
  it('returns nothing when no nutrient is flagged', () => {
    expect(suggestSwaps({ ...base, dish: B, profile })).toEqual([]);
    expect(suggestSwaps({ ...base, profile: makeProfile() })).toEqual([]);
  });
  it('never suggests the same dish', () => {
    expect(suggestSwaps({ ...base, profile }).map((s) => s.dishId)).not.toContain('a');
  });
});
