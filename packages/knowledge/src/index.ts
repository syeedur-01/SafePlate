import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dishesFile from '../data/source/dishes.json';
import ingredientsFile from '../data/source/ingredients.json';
import {
  RawDishesFileSchema,
  RawIngredientsFileSchema,
  NormalizedDishesFileSchema,
  SourcesFileSchema,
  SafetyRulesFileSchema,
  HealthRulesFileSchema,
  type RawDish,
  type Ingredient,
  type Dish,
  type SourceEntry,
  type SafetyRule,
  type HealthRule,
} from '@sp/contracts';

export * from './normalize';
export * from './messages';

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
/** Returns the source register entries from data/sources.json. */
export function getSources(): SourceEntry[] {
  return SourcesFileSchema.parse(readDataJson('sources.json')).sources;
}
/** Returns the live safety rules from data/rules/safety-rules.json (created by merge-rules). */
export function getSafetyRules(): SafetyRule[] {
  return SafetyRulesFileSchema.parse(readDataJson('rules/safety-rules.json')).rules;
}
/** Returns the live health rules from data/rules/health-rules.json (created by merge-rules). */
export function getHealthRules(): HealthRule[] {
  return HealthRulesFileSchema.parse(readDataJson('rules/health-rules.json')).rules;
}
/** Returns the demo dish ids from data/runtime/demo-dishes.json (the energy coverage gate). */
export function getDemoDishIds(): string[] {
  const file = readDataJson('runtime/demo-dishes.json') as {
    minCoverage?: unknown;
    dishIds?: unknown;
  };
  if (
    !Array.isArray(file.dishIds) ||
    file.dishIds.some((id) => typeof id !== 'string') ||
    file.dishIds.length === 0
  ) {
    throw new Error('data/runtime/demo-dishes.json has no valid dishIds list');
  }
  return [...file.dishIds];
}
