import { describe, it, expect } from 'vitest';
import type { HealthRule } from '@sp/contracts';
import { makeProfile } from '@sp/contracts/testing';
import { detectAllergens, analyzeLabel, type AllergenKeywords } from '../src/label';

const kw: AllergenKeywords = {
  milk: ['milk', 'whey'],
  egg: ['egg'],
  fish: ['fish'],
  crustacean_shellfish: ['prawn'],
  tree_nuts: ['cashew'],
  peanuts: ['peanut'],
  wheat_gluten: ['wheat', 'flour'],
  soy: ['soy'],
  sesame: ['sesame'],
  mustard: ['mustard'],
};
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

describe('detectAllergens', () => {
  it('finds allergens in the ingredient text', () => {
    expect(
      detectAllergens({ ingredientsText: 'Wheat flour, Whey powder', declaredAllergens: [] }, kw)
        .map((d) => d.allergen)
        .sort(),
    ).toEqual(['milk', 'wheat_gluten']);
  });
  it('prefers declared over ingredient detection', () => {
    expect(detectAllergens({ ingredientsText: 'milk', declaredAllergens: ['milk'] }, kw)).toEqual([
      { allergen: 'milk', via: 'declared' },
    ]);
  });
  it('is conservative: soybean matches soy', () => {
    expect(
      detectAllergens({ ingredientsText: 'soybean oil', declaredAllergens: [] }, kw)[0],
    ).toEqual({ allergen: 'soy', via: 'ingredients' });
  });
  it('handles missing text', () => {
    expect(detectAllergens({ ingredientsText: null, declaredAllergens: [] }, kw)).toEqual([]);
  });
});
describe('analyzeLabel', () => {
  const label = {
    ingredientsText: 'flour, whey',
    declaredAllergens: [],
    nutritionPer100g: { sodium_mg: 700 },
  };
  it('warns about an allergen the user has, with its source of detection', () => {
    const r = analyzeLabel({
      label,
      profile: makeProfile({ allergies: ['milk'] }),
      rules: [rule],
      keywords: kw,
    });
    expect(r.warnings[0]).toMatchObject({ kind: 'allergen', level: 'avoid', allergen: 'milk' });
    expect(r.warnings[0]?.params).toEqual({ allergen: 'milk', via: 'ingredients' });
  });
  it('evaluates nutrient rules per 100 g and tags the basis', () => {
    const w = analyzeLabel({
      label,
      profile: makeProfile({ conditions: ['hypertension'] }),
      rules: [rule],
      keywords: kw,
    }).warnings;
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ level: 'caution' });
    expect(w[0]?.params).toMatchObject({ nutrient: 'sodium_mg', percent: 35, basis: 'per_100g' });
  });
  it('reports insufficient data when the label has no nutrition', () => {
    const w = analyzeLabel({
      label: { ...label, nutritionPer100g: null },
      profile: makeProfile({ conditions: ['hypertension'] }),
      rules: [rule],
      keywords: kw,
    }).warnings;
    expect(w[0]?.messageKey).toBe('warn.insufficient_data');
  });
  it('says nothing for a profile with no conditions and no allergies', () => {
    expect(
      analyzeLabel({ label, profile: makeProfile(), rules: [rule], keywords: kw }).warnings,
    ).toEqual([]);
  });
});
