import { describe, it, expect } from 'vitest';
import { getDishes, getIngredients, ingredientsById } from '@sp/knowledge';
import { computeNutrition } from '../src/nutrition';

const dishes = getDishes();
const byId = ingredientsById(getIngredients());

/**
 * Published anchors for cooked composite dishes (per 100 g, edible):
 * - FCTB 2013 code 01_0035 "Plain Khichuri" Na 410 mg, code 01_0036 "Plain pulao" Na 167 mg
 *   (PDF pp. 28-29; khichuri recipe-calculated from Pasricha et al 2006, pulao from Rahim 2013).
 * - UK CoFID 2021 (McCance & Widdowson's Composition of Foods Integrated Dataset, PHE) code
 *   19-454 "Biryani, chicken, takeaway" Na 263 mg, analytical: 10 samples from 2 establishments
 *   in each of 5 regions (Aspland and James Ltd, Nutrient analysis of ethnic takeaway foods, 1997).
 * SafePlate sets each matching demo dish's salt line so the computed dish sodium reproduces
 * its anchor; these tests guard that derivation against accidental data drift.
 */
const COMPOSITE_TARGET_MG_PER_100G = {
  'bhuna-khichuri': 410, // FCTB 01_0035 Plain Khichuri
  'morog-polao': 167, // FCTB 01_0036 Plain pulao
  'kacchi-biryani': 263, // CoFID 19-454 Biryani, chicken, takeaway
};

describe('demo dishes with a published composite anchor', () => {
  for (const [dishId, target] of Object.entries(COMPOSITE_TARGET_MG_PER_100G)) {
    it(`computes ${dishId} sodium close to the published value of ${target} mg/100 g`, () => {
      const dish = dishes.find((d) => d.id === dishId);
      expect(dish, `dish ${dishId} exists in knowledge data`).toBeDefined();
      const result = computeNutrition(dish!, byId);
      const sodium = result.perServing.sodium_mg;
      expect(sodium.value).not.toBeNull();
      const per100g = (sodium.value! / dish!.serving_weight_g) * 100;
      // Tolerance covers the salt line being rounded to 2 decimals plus the
      // natural sodium contributed by the other ingredients.
      expect(per100g).toBeGreaterThan(target * 0.95);
      expect(per100g).toBeLessThan(target * 1.05);
      expect(sodium.origin).toBe('calculated');
      expect(sodium.shown).toBe(true);
    });
  }
});
