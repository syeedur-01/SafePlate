import { describe, it, expect } from 'vitest';
import type { NutritionResult, HealthRule, NutrientKey } from '@sp/contracts';
import { makeProfile } from '@sp/contracts/testing';
import { evaluateSuitability } from '../src/suitability';

const nr = (value: number | null, shown = true) => ({
  value,
  coverage: shown ? 1 : 0.2,
  shown,
  origin: 'calculated' as const,
});
const nutrition = (
  over: Partial<Record<NutrientKey, ReturnType<typeof nr>>> = {},
): NutritionResult => ({
  perServing: {
    energy_kcal: nr(null, false),
    protein_g: nr(null, false),
    fat_g: nr(null, false),
    sat_fat_g: nr(null, false),
    carbs_g: nr(null, false),
    sugars_g: nr(null, false),
    fibre_g: nr(null, false),
    sodium_mg: nr(null, false),
    ...over,
  },
  overallCoverage: 1,
  missingIngredientIds: [],
  estimated: true,
});
const sodiumRule: HealthRule = {
  kind: 'nutrient',
  id: 'htn-sodium',
  condition: 'hypertension',
  nutrient: 'sodium_mg',
  dailyLimit: 2000,
  cautionFraction: 0.3,
  avoidFraction: 0.6,
  messageKey: 'warn.sodium_high',
  sourceRef: 'S1',
  status: 'draft',
};
const fryRule: HealthRule = {
  kind: 'tag',
  id: 'chol-fried',
  condition: 'high_cholesterol',
  match: { cookingClasses: ['deep_fried'] },
  level: 'caution',
  messageKey: 'warn.fried',
  sourceRef: 'S2',
  status: 'draft',
};
const args = (over: object = {}) => ({
  profile: makeProfile({ conditions: ['hypertension'] }),
  dishAllergens: [],
  cookingClass: null,
  safetyTags: [],
  nutrition: nutrition({ sodium_mg: nr(100) }),
  rules: [sodiumRule, fryRule],
  ...over,
});

describe('evaluateSuitability', () => {
  it('says nothing when below the caution fraction', () => {
    expect(evaluateSuitability(args())).toEqual([]);
  });
  it('cautions at 35 percent and avoids at 65 percent of the daily limit', () => {
    const c = evaluateSuitability(args({ nutrition: nutrition({ sodium_mg: nr(700) }) }));
    expect(c[0]).toMatchObject({
      level: 'caution',
      messageKey: 'warn.sodium_high',
      sourceRef: 'S1',
      condition: 'hypertension',
    });
    expect(c[0]?.params).toEqual({ nutrient: 'sodium_mg', percent: 35 });
    expect(
      evaluateSuitability(args({ nutrition: nutrition({ sodium_mg: nr(1300) }) }))[0]?.level,
    ).toBe('avoid');
  });
  it('ignores rules for conditions the user does not have', () => {
    expect(
      evaluateSuitability(
        args({ profile: makeProfile(), nutrition: nutrition({ sodium_mg: nr(1900) }) }),
      ),
    ).toEqual([]);
  });
  it('reports insufficient data instead of guessing', () => {
    const w = evaluateSuitability(args({ nutrition: nutrition({ sodium_mg: nr(1900, false) }) }));
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({
      level: 'info',
      messageKey: 'warn.insufficient_data',
      id: 'insufficient:htn-sodium',
    });
    expect(w[0]?.params).toEqual({ nutrient: 'sodium_mg' });
    expect(evaluateSuitability(args({ nutrition: null }))[0]?.messageKey).toBe(
      'warn.insufficient_data',
    );
  });
  it('fires tag rules by cooking class', () => {
    const w = evaluateSuitability(
      args({
        profile: makeProfile({ conditions: ['high_cholesterol'] }),
        cookingClass: 'deep_fried',
      }),
    );
    expect(w.map((x) => x.id)).toEqual(['chol-fried']);
  });
  it('puts allergen warnings first, then avoid, caution, info', () => {
    const w = evaluateSuitability(
      args({
        profile: makeProfile({
          conditions: ['hypertension', 'high_cholesterol'],
          allergies: ['milk'],
        }),
        dishAllergens: ['milk'],
        cookingClass: 'deep_fried',
        nutrition: nutrition({ sodium_mg: nr(1300) }),
      }),
    );
    expect(w.map((x) => x.level)).toEqual(['avoid', 'avoid', 'caution']);
    expect(w[0]?.kind).toBe('allergen');
  });
});
