import type { Ingredient, NutritionResult, RawDish } from '@sp/contracts';

export const MIN_COVERAGE = 0.8;

/** Returns per-serving nutrients for a dish with per-nutrient coverage, per TECH_DESIGN §4.1. */
export function computeNutrition(
  dish: RawDish,
  ingredients: Map<string, Ingredient>,
  options?: { minCoverage?: number },
): NutritionResult {
  const minCoverage = options?.minCoverage ?? MIN_COVERAGE;
  const lines = dish.ingredients.filter((line) => line.ingredient_id !== 'water');

  for (const line of lines) {
    if (!ingredients.has(line.ingredient_id))
      throw new Error(`Unknown ingredient: ${line.ingredient_id}`);
  }

  const totalGrams = lines.reduce((sum, line) => sum + line.grams_raw, 0);
  const missingIngredientIds: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const id = line.ingredient_id;
    if (seen.has(id)) continue;
    seen.add(id);
    const ingredient = ingredients.get(id);
    if (ingredient && ingredient.energy_kcal === null) missingIngredientIds.push(id);
  }

  type NutrientEntry = NutritionResult['perServing'][keyof NutritionResult['perServing']];
  const nutrientResult = (nutrient: keyof NutritionResult['perServing']): NutrientEntry => {
    let coveredGrams = 0;
    let sum = 0;
    for (const line of lines) {
      const value = ingredients.get(line.ingredient_id)?.[nutrient];
      if (value === null || value === undefined) continue;
      sum += (line.grams_raw * value) / 100;
      coveredGrams += line.grams_raw;
    }
    const coverage = totalGrams === 0 ? 0 : coveredGrams / totalGrams;
    const labValue =
      dish.nutrition_basis === 'lab_analyzed'
        ? dish.lab_values_per_serving?.values[nutrient]
        : undefined;
    if (labValue !== null && labValue !== undefined) {
      return {
        value: (labValue * dish.serving_weight_g) / 100,
        coverage: 1,
        shown: 1 >= minCoverage,
        origin: 'lab_scaled',
      };
    }
    return {
      value: coveredGrams > 0 ? sum : null,
      coverage,
      shown: coverage >= minCoverage,
      origin: coveredGrams > 0 ? 'calculated' : 'none',
    };
  };

  const perServing = {
    energy_kcal: nutrientResult('energy_kcal'),
    protein_g: nutrientResult('protein_g'),
    fat_g: nutrientResult('fat_g'),
    sat_fat_g: nutrientResult('sat_fat_g'),
    carbs_g: nutrientResult('carbs_g'),
    sugars_g: nutrientResult('sugars_g'),
    fibre_g: nutrientResult('fibre_g'),
    sodium_mg: nutrientResult('sodium_mg'),
  };
  return {
    perServing,
    overallCoverage: perServing.energy_kcal.coverage,
    missingIngredientIds,
    estimated: true,
  };
}
