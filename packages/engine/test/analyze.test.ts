import { describe, it, expect } from 'vitest';
import type { Dish, HealthRule } from '@sp/contracts';
import { AnalysisResultSchema } from '@sp/contracts';
import { makeDish, makeIngredient, makeProfile } from '@sp/contracts/testing';
import { analyze, type AnalyzeInput } from '../src/analyze';
import type { AllergenKeywords } from '../src/label';

const ingredients = new Map(
  [
    makeIngredient({ id: 'rice', energy_kcal: 130, sodium_mg: 5 }),
    makeIngredient({ id: 'salt', sodium_mg: 2000 }),
  ].map((i) => [i.id, i]),
);

const dish = (id: string, lines: { id: string; grams: number }[]): Dish =>
  ({
    ...makeDish({
      id,
      ingredients: lines.map((line) => ({
        ingredient_id: line.id,
        grams_raw: line.grams,
        quantity_basis: 'ESTIMATE' as const,
      })),
      allergens: ['milk'],
      safety_tags: ['fried'],
    }),
    cooking_class: 'deep_fried',
  }) as unknown as Dish;

const sodiumRule: HealthRule = {
  kind: 'nutrient',
  id: 'htn-sodium',
  condition: 'hypertension',
  nutrient: 'sodium_mg',
  dailyLimit: 2000,
  cautionFraction: 0.3,
  avoidFraction: 0.6,
  messageKey: 'warn.sodium_high',
  sourceRef: 'fixture',
  status: 'draft',
};

const keywords: AllergenKeywords = {
  milk: ['milk'],
  egg: ['egg'],
  fish: ['fish'],
  crustacean_shellfish: ['prawn'],
  tree_nuts: ['cashew'],
  peanuts: ['peanut'],
  wheat_gluten: ['wheat'],
  soy: ['soy'],
  sesame: ['sesame'],
  mustard: ['mustard'],
};

const base = (over: Partial<AnalyzeInput> = {}): AnalyzeInput => ({
  scanKind: 'dish',
  dishId: 'd1',
  dishes: [
    dish('d1', [{ id: 'rice', grams: 200 }]),
    dish('d2', [
      { id: 'rice', grams: 100 },
      { id: 'salt', grams: 10 },
    ]),
  ],
  ingredients,
  observations: { spoilageSigns: [], imageQuality: 'good' },
  context: { place: 'home', storage: 'unknown', hoursSinceCooked: null },
  label: null,
  profile: makeProfile({ conditions: ['hypertension'] }),
  safetyRules: [],
  healthRules: [sodiumRule],
  allergenKeywords: keywords,
  today: '2026-10-26',
  ...over,
});

describe('analyze', () => {
  it('returns safety, warnings, nutrition, swaps and a shopping list for a dish', () => {
    const result = analyze(base());
    expect(result.dishId).toBe('d1');
    expect(result.safety.notices.length).toBeGreaterThan(0);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.nutrition).not.toBeNull();
    expect(Array.isArray(result.swaps)).toBe(true);
    expect(result.shoppingList.length).toBeGreaterThan(0);
    expect(AnalysisResultSchema.safeParse(result).success).toBe(true);
  });
  it('throws for an unknown dish id', () => {
    expect(() => analyze(base({ dishId: 'nope' }))).toThrow('Unknown dish: nope');
  });
  it('returns a label result with no dish nutrition, swaps or shopping list', () => {
    const result = analyze(
      base({
        scanKind: 'label',
        dishId: null,
        label: {
          ingredientsText: 'milk, wheat flour',
          declaredAllergens: [],
          nutritionPer100g: { sodium_mg: 700 },
          expiryDate: '2026-12-31',
        },
      }),
    );
    expect(result.dishId).toBeNull();
    expect(result.nutrition).toBeNull();
    expect(result.swaps).toEqual([]);
    expect(result.shoppingList).toEqual([]);
    expect(AnalysisResultSchema.safeParse(result).success).toBe(true);
  });
  it('doubles the shopping list grams for two servings', () => {
    const grams = (result: ReturnType<typeof analyze>) =>
      Object.fromEntries(result.shoppingList.map((item) => [item.ingredientId, item.grams]));
    const one = grams(analyze(base({ servings: 1 })));
    const two = grams(analyze(base({ servings: 2 })));
    expect(two).toEqual({ rice: (one.rice ?? 0) * 2 });
  });
  it('is deterministic for the same input', () => {
    expect(analyze(base())).toEqual(analyze(base()));
  });
});
