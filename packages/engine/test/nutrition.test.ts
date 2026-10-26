import { describe, it, expect } from 'vitest';
import { makeDish, makeIngredient } from '@sp/contracts/testing';
import { computeNutrition } from '../src/nutrition';

const map = (list: ReturnType<typeof makeIngredient>[]) => new Map(list.map((i) => [i.id, i]));
const line = (id: string, g: number) => ({
  ingredient_id: id,
  grams_raw: g,
  quantity_basis: 'ESTIMATE' as const,
});

describe('computeNutrition', () => {
  it('sums grams times value per 100 g', () => {
    const m = map([
      makeIngredient({ id: 'rice', energy_kcal: 345 }),
      makeIngredient({ id: 'oil', energy_kcal: 900 }),
    ]);
    const r = computeNutrition(
      makeDish({ id: 'd', ingredients: [line('rice', 100), line('oil', 10)] }),
      m,
    );
    expect(r.perServing.energy_kcal.value).toBeCloseTo(435);
    expect(r.perServing.energy_kcal.coverage).toBe(1);
    expect(r.perServing.energy_kcal.shown).toBe(true);
    expect(r.perServing.energy_kcal.origin).toBe('calculated');
    expect(r.estimated).toBe(true);
    expect(r.overallCoverage).toBe(1);
  });
  it('does not treat null as zero', () => {
    const m = map([
      makeIngredient({ id: 'rice', energy_kcal: 345 }),
      makeIngredient({ id: 'hilsa' }),
    ]);
    const r = computeNutrition(
      makeDish({ id: 'd', ingredients: [line('rice', 100), line('hilsa', 100)] }),
      m,
    );
    expect(r.perServing.energy_kcal.coverage).toBeCloseTo(0.5);
    expect(r.perServing.energy_kcal.shown).toBe(false);
    expect(r.perServing.energy_kcal.value).toBeCloseTo(345);
    expect(r.missingIngredientIds).toEqual(['hilsa']);
  });
  it('ignores water in value and coverage', () => {
    const m = map([
      makeIngredient({ id: 'rice', energy_kcal: 345 }),
      makeIngredient({ id: 'water' }),
    ]);
    const r = computeNutrition(
      makeDish({ id: 'd', ingredients: [line('rice', 100), line('water', 100)] }),
      m,
    );
    expect(r.perServing.energy_kcal.coverage).toBe(1);
    expect(r.missingIngredientIds).toEqual([]);
  });
  it('shows a nutrient at exactly the minimum coverage and hides it below', () => {
    const m = map([makeIngredient({ id: 'a', energy_kcal: 100 }), makeIngredient({ id: 'b' })]);
    const d = makeDish({ id: 'd', ingredients: [line('a', 80), line('b', 20)] });
    expect(computeNutrition(d, m).perServing.energy_kcal.shown).toBe(true);
    expect(computeNutrition(d, m, { minCoverage: 0.9 }).perServing.energy_kcal.shown).toBe(false);
  });
  it('returns null value and origin none when no ingredient has the nutrient', () => {
    const m = map([makeIngredient({ id: 'a', energy_kcal: 100 })]);
    const r = computeNutrition(makeDish({ id: 'd', ingredients: [line('a', 100)] }), m);
    expect(r.perServing.sat_fat_g).toEqual({
      value: null,
      coverage: 0,
      shown: false,
      origin: 'none',
    });
  });
  it('scales lab values from per 100 g cooked to the serving, falling back per nutrient', () => {
    const m = map([makeIngredient({ id: 'chicken', energy_kcal: 120 })]);
    const d = makeDish({
      id: 'roast',
      serving_weight_g: 300,
      nutrition_basis: 'lab_analyzed',
      ingredients: [line('chicken', 200)],
      lab_values_per_serving: {
        value_basis: 'per_100_g_cooked_as_published',
        values: {
          energy_kcal: null,
          protein_g: 10.9,
          fat_g: 22.3,
          sat_fat_g: null,
          carbs_g: 3.6,
          sugars_g: null,
          fibre_g: 0.5,
          sodium_mg: null,
        },
      },
    });
    const r = computeNutrition(d, m);
    expect(r.perServing.protein_g.value).toBeCloseTo(32.7);
    expect(r.perServing.protein_g.origin).toBe('lab_scaled');
    expect(r.perServing.protein_g.coverage).toBe(1);
    expect(r.perServing.energy_kcal.origin).toBe('calculated');
    expect(r.perServing.energy_kcal.value).toBeCloseTo(240);
  });
  it('throws on an unknown ingredient', () => {
    expect(() =>
      computeNutrition(makeDish({ id: 'd', ingredients: [line('nope', 10)] }), new Map()),
    ).toThrow('Unknown ingredient: nope');
  });
});
