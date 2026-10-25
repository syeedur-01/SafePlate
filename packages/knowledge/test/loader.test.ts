import { describe, it, expect } from 'vitest';
import { getRawDishes, getRawIngredients, ingredientsById } from '../src';

describe('knowledge loader', () => {
  it('loads 30 dishes and 56 ingredients', () => {
    expect(getRawDishes()).toHaveLength(30);
    expect(getRawIngredients()).toHaveLength(56);
  });
  it('resolves every dish ingredient', () => {
    const map = ingredientsById();
    for (const d of getRawDishes())
      for (const l of d.ingredients) expect(map.has(l.ingredient_id)).toBe(true);
  });
});
