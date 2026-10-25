import dishesFile from '../data/source/dishes.json';
import ingredientsFile from '../data/source/ingredients.json';
import {
  RawDishesFileSchema,
  RawIngredientsFileSchema,
  type RawDish,
  type Ingredient,
} from '@sp/contracts';

/** Returns the 30 validated source dishes. */
export function getRawDishes(): RawDish[] {
  return RawDishesFileSchema.parse(dishesFile).dishes;
}
/** Returns the 56 validated source ingredients. */
export function getRawIngredients(): Ingredient[] {
  return RawIngredientsFileSchema.parse(ingredientsFile).ingredients;
}
/** Returns a map from ingredient id to ingredient. */
export function ingredientsById(list: Ingredient[] = getRawIngredients()): Map<string, Ingredient> {
  return new Map(list.map((i) => [i.id, i]));
}
