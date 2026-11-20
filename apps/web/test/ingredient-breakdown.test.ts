// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { makeDish, makeIngredient } from '@sp/contracts/testing';
import type { Ingredient } from '@sp/contracts';
import { BREAKDOWN_NUTRIENTS, buildIngredientBreakdown } from '../src/lib/ingredient-breakdown';

const RICE = makeIngredient({
  id: 'white-rice',
  name_en: 'White rice',
  name_bn: 'সাদা চাল',
  energy_kcal: 345,
  protein_g: 6.6,
  fat_g: 0.3,
  sodium_mg: 5,
  source: [
    {
      source_id: 'FCTB-2013',
      source_name: 'Food Composition Table for Bangladesh',
      publisher: 'INFS, Dhaka',
      year: 2013,
      url: 'https://example.org/fctb.pdf',
    },
  ],
});

const ONION = makeIngredient({
  id: 'onion',
  name_en: 'Onion',
  name_bn: 'পেঁয়াজ',
  energy_kcal: 40,
  protein_g: null,
  fat_g: null,
  sodium_mg: null,
  source: [
    {
      source_id: 'FCTB-2013',
      source_name: 'Food Composition Table for Bangladesh',
      publisher: 'INFS, Dhaka',
      year: 2013,
      url: 'https://example.org/fctb.pdf',
    },
  ],
});

const MISSING: Record<string, Ingredient> = { 'white-rice': RICE, onion: ONION };
const getIngredient = (id: string) => MISSING[id];

const DISH = makeDish({
  id: 'khichuri',
  ingredients: [
    { ingredient_id: 'white-rice', grams_raw: 150, quantity_basis: 'SOURCE' },
    { ingredient_id: 'onion', grams_raw: 40, quantity_basis: 'ESTIMATE' },
    { ingredient_id: 'unknown-item', grams_raw: 5, quantity_basis: 'ESTIMATE' },
  ],
});

describe('buildIngredientBreakdown', () => {
  it('returns one row per ingredient line in recipe order', () => {
    const { rows } = buildIngredientBreakdown(DISH.ingredients, 'en', getIngredient);
    expect(rows.map((row) => row.ingredientId)).toEqual(['white-rice', 'onion', 'unknown-item']);
  });

  it('localizes names and falls back to the id when no record exists', () => {
    const en = buildIngredientBreakdown(DISH.ingredients, 'en', getIngredient);
    const bn = buildIngredientBreakdown(DISH.ingredients, 'bn', getIngredient);
    expect(en.rows[0]?.name).toBe('White rice');
    expect(bn.rows[0]?.name).toBe('সাদা চাল');
    expect(en.rows[2]?.name).toBe('unknown-item');
    expect(bn.rows[2]?.name).toBe('unknown-item');
  });

  it('carries recipe grams and the estimate flag through', () => {
    const { rows } = buildIngredientBreakdown(DISH.ingredients, 'en', getIngredient);
    expect(rows[0]).toMatchObject({ grams: 150, estimated: false });
    expect(rows[1]).toMatchObject({ grams: 40, estimated: true });
  });

  it('keeps missing composition values null instead of inventing zero', () => {
    const { rows } = buildIngredientBreakdown(DISH.ingredients, 'en', getIngredient);
    const onion = rows[1]!;
    expect(onion.values.find((v) => v.key === 'energy_kcal')?.value).toBe(40);
    expect(onion.values.find((v) => v.key === 'protein_g')?.value).toBeNull();
    expect(onion.values.find((v) => v.key === 'sodium_mg')?.value).toBeNull();
  });

  it('shows a dash for null values and never prints 0 for them', () => {
    const { rows } = buildIngredientBreakdown(DISH.ingredients, 'en', getIngredient);
    const nullValues = rows[1]!.values.filter((v) => v.value === null);
    expect(nullValues.length).toBeGreaterThan(0);
    for (const value of nullValues) {
      expect(value.value).not.toBe(0);
    }
  });

  it('exposes exactly the four breakdown nutrients', () => {
    const { rows } = buildIngredientBreakdown(DISH.ingredients, 'en', getIngredient);
    expect(rows[0]!.values.map((v) => v.key)).toEqual([...BREAKDOWN_NUTRIENTS]);
  });

  it('lists each unique source once with its provenance', () => {
    const { sources } = buildIngredientBreakdown(DISH.ingredients, 'en', getIngredient);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toEqual({
      sourceName: 'Food Composition Table for Bangladesh',
      publisher: 'INFS, Dhaka',
      year: 2013,
      url: 'https://example.org/fctb.pdf',
    });
  });

  it('returns no sources when no ingredient record has provenance', () => {
    const dish = makeDish({
      id: 'plain',
      ingredients: [{ ingredient_id: 'ghost', grams_raw: 10, quantity_basis: 'ESTIMATE' }],
    });
    const result = buildIngredientBreakdown(dish.ingredients, 'en', getIngredient);
    expect(result.rows).toHaveLength(1);
    expect(result.sources).toEqual([]);
  });
});
