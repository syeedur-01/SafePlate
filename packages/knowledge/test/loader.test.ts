import { describe, it, expect } from 'vitest';
import { getCatalogue, getRawDishes, getRawIngredients, ingredientsById } from '../src';

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

describe('recognition catalogue loader', () => {
  it('covers every approved nutrition dish and has unique ids', () => {
    const catalogue = getCatalogue();
    const ids = new Set(catalogue.entries.map((e) => e.id));
    expect(ids.size).toBe(catalogue.entries.length);
    for (const dish of getRawDishes()) expect(ids.has(dish.id)).toBe(true);
  });
  it('has at least one catalogue-only entry and only resolvable nutrition links', () => {
    const catalogue = getCatalogue();
    const dishIds = new Set(getRawDishes().map((d) => d.id));
    const linked = catalogue.entries.filter((e) => e.nutrition_dish_id !== null);
    expect(linked.length).toBeGreaterThan(0);
    expect(catalogue.entries.length).toBeGreaterThan(linked.length);
    for (const entry of linked) {
      const id = entry.nutrition_dish_id;
      if (id !== null) expect(dishIds.has(id)).toBe(true);
    }
  });
  it('provenance is recorded for every entry', () => {
    for (const entry of getCatalogue().entries) {
      expect(entry.provenance.source.length).toBeGreaterThan(0);
      expect(entry.provenance.added).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
