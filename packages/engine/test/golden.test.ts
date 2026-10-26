import { describe, it, expect } from 'vitest';
import type { Allergen, AnalysisResult, HealthRule, UserProfile } from '@sp/contracts';
import { AnalysisResultSchema, NUTRIENT_KEYS } from '@sp/contracts';
import { makeProfile } from '@sp/contracts/testing';
import { getDishes, getIngredients } from '@sp/knowledge';
import { analyze, type AnalyzeInput } from '../src/analyze';
import type { AllergenKeywords } from '../src/label';

const dishes = getDishes();
const ingredients = new Map(getIngredients().map((ingredient) => [ingredient.id, ingredient]));

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

const ALL_ALLERGENS: Allergen[] = [
  'milk',
  'egg',
  'fish',
  'crustacean_shellfish',
  'tree_nuts',
  'peanuts',
  'wheat_gluten',
  'soy',
  'sesame',
  'mustard',
];

const healthRules: HealthRule[] = [
  {
    kind: 'nutrient',
    id: 'fixture-hypertension-sodium',
    condition: 'hypertension',
    nutrient: 'sodium_mg',
    dailyLimit: 2000,
    cautionFraction: 0.3,
    avoidFraction: 0.6,
    messageKey: 'warn.sodium_high',
    sourceRef: 'fixture',
    status: 'draft',
  },
  {
    kind: 'nutrient',
    id: 'fixture-diabetes-sugars',
    condition: 'diabetes',
    nutrient: 'sugars_g',
    dailyLimit: 50,
    cautionFraction: 0.2,
    avoidFraction: 0.5,
    messageKey: 'warn.sugar_high',
    sourceRef: 'fixture',
    status: 'draft',
  },
];

const profiles: { name: string; profile: UserProfile }[] = [
  { name: 'an empty profile', profile: makeProfile() },
  {
    name: 'hypertension and diabetes',
    profile: makeProfile({ conditions: ['hypertension', 'diabetes'] }),
  },
  { name: 'all ten allergies', profile: makeProfile({ allergies: ALL_ALLERGENS }) },
];

const input = (dishId: string, profile: UserProfile): AnalyzeInput => ({
  scanKind: 'dish',
  dishId,
  dishes,
  ingredients,
  observations: { spoilageSigns: [], imageQuality: 'good' },
  context: { place: 'unknown', storage: 'unknown', hoursSinceCooked: null },
  label: null,
  profile,
  safetyRules: [],
  healthRules,
  allergenKeywords: keywords,
  today: '2026-10-26',
});

const dishIds = dishes.map((dish) => dish.id);

describe.each(profiles)('golden run for $name', ({ profile }) => {
  const results = new Map<string, AnalysisResult>();
  const run = (dishId: string): AnalysisResult => {
    const cached = results.get(dishId);
    if (cached) return cached;
    const result = analyze(input(dishId, profile));
    results.set(dishId, result);
    return result;
  };

  it.each(dishIds)('returns a valid AnalysisResult for %s', (dishId) => {
    expect(AnalysisResultSchema.safeParse(run(dishId)).success).toBe(true);
  });

  it.each(dishIds)('serializes without NaN, Infinity or undefined for %s', (dishId) => {
    const json = JSON.stringify(run(dishId));
    expect(json).not.toContain('NaN');
    expect(json).not.toContain('Infinity');
    expect(json).not.toContain('undefined');
  });

  it.each(dishIds)('keeps shown in step with coverage for %s', (dishId) => {
    const nutrition = run(dishId).nutrition;
    expect(nutrition).not.toBeNull();
    for (const nutrient of NUTRIENT_KEYS) {
      const entry = nutrition?.perServing[nutrient];
      expect(entry?.shown).toBe((entry?.coverage ?? 0) >= 0.8);
    }
  });

  it.each(dishIds)('is stable across two calls for %s', (dishId) => {
    expect(run(dishId)).toEqual(analyze(input(dishId, profile)));
  });
});

describe('golden run for all ten allergies', () => {
  const profile = makeProfile({ allergies: ALL_ALLERGENS });
  const withAllergens = dishes.filter((dish) => dish.allergens.length > 0);

  it.each(withAllergens.map((dish) => dish.id))(
    'puts an allergen warning first for %s',
    (dishId) => {
      const warnings = analyze(input(dishId, profile)).warnings;
      expect(warnings[0]?.kind).toBe('allergen');
    },
  );
});
