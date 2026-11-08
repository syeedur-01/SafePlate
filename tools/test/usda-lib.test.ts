import { describe, it, expect } from 'vitest';
import { makeIngredient } from '@sp/contracts/testing';
import { parseUsda, searchFoods, fillablePatch } from '../src/usda-lib';
const food =
  'fdc_id,data_type,description\n1,sr_legacy_food,"Turmeric, ground"\n2,sr_legacy_food,"Fish, herring, raw"';
const nutrient =
  'id,name,unit_name,nutrient_nbr\n10,Energy,KCAL,208\n11,"Sodium, Na",MG,307\n12,"Fatty acids, total saturated",G,606\n13,"Sugars, total including NLEA",G,269\n14,"Fiber, total dietary",G,291\n15,Protein,G,203\n16,"Total lipid (fat)",G,204\n17,"Carbohydrate, by difference",G,205';
const fn = 'id,fdc_id,nutrient_id,amount\n1,1,10,312\n2,1,11,38\n3,2,10,158\n4,2,12,3.1';
describe('usda-lib', () => {
  const foods = parseUsda(food, nutrient, fn);
  it('parses foods with their nutrient values', () => {
    expect(foods).toHaveLength(2);
    expect(foods.find((f) => f.fdcId === 1)?.values).toMatchObject({
      energy_kcal: 312,
      sodium_mg: 38,
    });
  });
  it('throws when a nutrient number has the wrong name', () => {
    expect(() => parseUsda(food, nutrient.replace('Energy', 'Water'), fn)).toThrow();
  });
  it('prefers matching descriptions', () => {
    expect(searchFoods('turmeric', foods)[0]?.fdcId).toBe(1);
  });
  it('fills only null fields and never overwrites', () => {
    const ing = makeIngredient({ id: 'turmeric', energy_kcal: 354 });
    const patch = fillablePatch(ing, foods[0]!);
    expect(patch.energy_kcal).toBeUndefined();
    expect(patch.sodium_mg).toBe(38);
  });
});
