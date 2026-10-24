import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  NUTRIENT_KEYS,
  RawDishesFileSchema,
  RawIngredientsFileSchema,
  RawDishSchema,
  findDanglingRefs,
} from '../src/knowledge';

const load = (name: string) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../knowledge/data/source/${name}`, import.meta.url)),
      'utf8',
    ),
  );

describe('real data files', () => {
  const dishesFile = RawDishesFileSchema.parse(load('dishes.json'));
  const ingredientsFile = RawIngredientsFileSchema.parse(load('ingredients.json'));

  it('contains 30 dishes and 56 ingredients', () => {
    expect(dishesFile.dishes).toHaveLength(30);
    expect(ingredientsFile.ingredients).toHaveLength(56);
  });
  it('has no dangling ingredient references', () => {
    expect(findDanglingRefs(dishesFile.dishes, ingredientsFile.ingredients)).toEqual([]);
  });
  it('has unique ids', () => {
    const ids = dishesFile.dishes.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('schema strictness', () => {
  const good = (load('dishes.json') as { dishes: unknown[] }).dishes[0];
  it('rejects a dish with no ingredients', () => {
    expect(RawDishSchema.safeParse({ ...(good as object), ingredients: [] }).success).toBe(false);
  });
  it('rejects an unknown nutrition_basis', () => {
    expect(
      RawDishSchema.safeParse({ ...(good as object), nutrition_basis: 'guessed' }).success,
    ).toBe(false);
  });
  it('finds a dangling reference', () => {
    const d = RawDishSchema.parse(good);
    expect(findDanglingRefs([d], [])).not.toEqual([]);
  });
  it('has exactly 8 nutrient keys', () => {
    expect(NUTRIENT_KEYS).toHaveLength(8);
  });
});
