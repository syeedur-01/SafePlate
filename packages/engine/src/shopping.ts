import type { AnalysisResult, Dish } from '@sp/contracts';

type ShoppingItem = AnalysisResult['shoppingList'][number];

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 20;

/** Returns raw ingredient grams for N servings, water excluded, grams rounded to 0.1, sorted by grams descending then id. Throws RangeError unless servings is an integer from 1 to 20. */
export function buildShoppingList(dish: Dish, servings: number): ShoppingItem[] {
  if (!Number.isInteger(servings) || servings < MIN_SERVINGS || servings > MAX_SERVINGS) {
    throw new RangeError(
      `servings must be an integer from ${MIN_SERVINGS} to ${MAX_SERVINGS}, got ${servings}`,
    );
  }

  const gramsById = new Map<string, number>();
  for (const line of dish.ingredients) {
    if (line.ingredient_id === 'water') continue;
    const grams = line.grams_raw * servings;
    gramsById.set(line.ingredient_id, (gramsById.get(line.ingredient_id) ?? 0) + grams);
  }

  return [...gramsById.entries()]
    .map(([ingredientId, grams]) => ({
      ingredientId,
      grams: Math.round(grams * 10) / 10,
    }))
    .sort(
      (a, b) =>
        b.grams - a.grams ||
        (a.ingredientId < b.ingredientId ? -1 : a.ingredientId > b.ingredientId ? 1 : 0),
    );
}
