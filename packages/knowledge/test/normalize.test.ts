import { describe, it, expect } from 'vitest';
import { makeDish } from '@sp/contracts/testing';
import { normalizeAllergen, classifyCooking, normalizeDish } from '../src/normalize';
import { getRawDishes, getDishes } from '../src';

describe('normalizeAllergen', () => {
  it.each([
    ['dairy', 'milk'],
    ['milk', 'milk'],
    ['Wheat_Gluten', 'wheat_gluten'],
    ['tree_nuts', 'tree_nuts'],
    ['crustacean_shellfish', 'crustacean_shellfish'],
    ['mustard', 'mustard'],
  ] as const)('%s -> %s', (raw, out) => {
    expect(normalizeAllergen(raw)).toBe(out);
  });
  it('returns null for unknown', () => {
    expect(normalizeAllergen('pollen')).toBeNull();
  });
});

describe('classifyCooking', () => {
  it.each([
    ['steamed in cloth over boiling water', 'steamed'],
    ['milk reduced, sweetened and fermented', 'sweet_milk_based'],
    ['soaked/fermented cooked rice served with fried fish', 'fermented'],
    ['shells deep-fried, then filled at serving', 'deep_fried'],
    ['shallow-fried', 'shallow_fried'],
    ['boiled and mashed', 'boiled_or_simmered'],
    ['roasted, peeled and mashed', 'baked_or_roasted'],
    ['something unusual', 'mixed_or_other'],
  ] as const)('%s -> %s', (text, cls) => {
    expect(classifyCooking(text)).toBe(cls);
  });
});

describe('normalizeDish', () => {
  it('deduplicates dairy and milk', () => {
    expect(normalizeDish(makeDish({ id: 'd', allergens: ['dairy', 'milk'] })).allergens).toEqual([
      'milk',
    ]);
  });
  it('throws with the dish id on an unknown allergen', () => {
    expect(() => normalizeDish(makeDish({ id: 'dish-x', allergens: ['pollen'] }))).toThrow(
      'dish-x',
    );
  });
  it('never changes ingredient lines or serving weight', () => {
    const raw = getRawDishes();
    const norm = getDishes();
    expect(norm).toHaveLength(raw.length);
    raw.forEach((r, i) => {
      expect(norm[i]?.ingredients).toEqual(r.ingredients);
      expect(norm[i]?.serving_weight_g).toBe(r.serving_weight_g);
    });
  });
  it('gives every real dish a cooking class', () => {
    for (const d of getDishes()) expect(d.cooking_class).toBeTruthy();
  });
});
