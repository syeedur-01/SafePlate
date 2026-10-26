import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dishesFile from '../data/source/dishes.json';
import ingredientsFile from '../data/source/ingredients.json';
import {
  RawDishesFileSchema,
  RawIngredientsFileSchema,
  NormalizedDishesFileSchema,
  type RawDish,
  type Ingredient,
  type Dish,
} from '@sp/contracts';

export * from './normalize';

const knowledgeDataUrl = new URL('../data/', import.meta.url);

/** Returns parsed JSON from a path relative to packages/knowledge/data/ (lazy, so the package loads before the generated files exist). */
function readDataJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(relativePath, knowledgeDataUrl)), 'utf8'));
}

/** Returns the 30 validated source dishes. */
export function getRawDishes(): RawDish[] {
  return RawDishesFileSchema.parse(dishesFile).dishes;
}
/** Returns the 56 validated source ingredients. */
export function getRawIngredients(): Ingredient[] {
  return RawIngredientsFileSchema.parse(ingredientsFile).ingredients;
}
/** Returns the normalized dishes from data/normalized/ (canonical allergens, cooking class). */
export function getDishes(): Dish[] {
  return NormalizedDishesFileSchema.parse(readDataJson('normalized/dishes.json')).dishes;
}
/** Returns the normalized ingredients from data/normalized/. */
export function getIngredients(): Ingredient[] {
  return RawIngredientsFileSchema.parse(readDataJson('normalized/ingredients.json')).ingredients;
}
/** Returns a map from ingredient id to ingredient. */
export function ingredientsById(list: Ingredient[] = getRawIngredients()): Map<string, Ingredient> {
  return new Map(list.map((i) => [i.id, i]));
}
