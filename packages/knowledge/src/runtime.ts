import type { Dish, Ingredient } from '@sp/contracts';
import { getDishes, getIngredients } from './index';

type NutrientSubset = {
  energy_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  sat_fat_g: number | null;
  carbs_g: number | null;
  sugars_g: number | null;
  fibre_g: number | null;
  sodium_mg: number | null;
};

/** Returns the 8 nutrient values of an ingredient, nothing else. */
function nutrientSubset(i: Ingredient): NutrientSubset {
  return {
    energy_kcal: i.energy_kcal,
    protein_g: i.protein_g,
    fat_g: i.fat_g,
    sat_fat_g: i.sat_fat_g,
    carbs_g: i.carbs_g,
    sugars_g: i.sugars_g,
    fibre_g: i.fibre_g,
    sodium_mg: i.sodium_mg,
  };
}

/** Returns the slim dish record used in the browser. */
function runtimeDish(d: Dish) {
  return {
    id: d.id,
    name_en: d.name_en,
    name_bn: d.name_bn,
    aliases: d.aliases,
    category: d.category,
    serving_description: d.serving_description,
    serving_weight_g: d.serving_weight_g,
    ingredients: d.ingredients,
    allergens: d.allergens,
    safety_tags: d.safety_tags,
    cooking_class: d.cooking_class,
    nutrition_basis: d.nutrition_basis,
    lab_values_per_serving: d.lab_values_per_serving
      ? {
          value_basis: d.lab_values_per_serving.value_basis,
          values: d.lab_values_per_serving.values,
        }
      : null,
  };
}

/** Returns the slim ingredient record used in the browser. */
function runtimeIngredient(i: Ingredient) {
  return {
    id: i.id,
    name_en: i.name_en,
    name_bn: i.name_bn,
    ...nutrientSubset(i),
    ...(i.match_quality !== undefined ? { match_quality: i.match_quality } : {}),
  };
}

/**
 * Returns the in-memory browser runtime built from the normalized data files
 * (which carry the approved match values). `pnpm --filter @sp/tools normalize`
 * writes this object to data/runtime/runtime.json; the runtime-sync test fails
 * if the committed file drifts from it.
 */
export function buildRuntime(): { dishes: unknown[]; ingredients: unknown[] } {
  return {
    dishes: getDishes().map(runtimeDish),
    ingredients: getIngredients().map(runtimeIngredient),
  };
}
