import type { Ingredient, RawDish } from './knowledge';
import type { UserProfile } from './profile';
import { EMPTY_PROFILE } from './profile';

/** Returns a valid ingredient with all nutrients null unless overridden. */
export function makeIngredient(over: Partial<Ingredient> & { id: string }): Ingredient {
  return {
    name_en: over.id,
    name_bn: '',
    basis: 'per_100_g_raw_ingredient',
    energy_kcal: null,
    protein_g: null,
    fat_g: null,
    sat_fat_g: null,
    carbs_g: null,
    sugars_g: null,
    fibre_g: null,
    sodium_mg: null,
    source: [],
    nutrient_sources: {},
    ...over,
  } as Ingredient;
}

/** Returns a valid dish with one 100 g ingredient line unless overridden. */
export function makeDish(over: Partial<RawDish> & { id: string }): RawDish {
  return {
    name_en: over.id,
    name_bn: '',
    aliases: [],
    category: 'test',
    serving_description: '1 serving (estimated)',
    serving_weight_g: 200,
    serving_weight_basis: 'ESTIMATE',
    ingredients: [{ ingredient_id: 'x', grams_raw: 100, quantity_basis: 'ESTIMATE' }],
    cooking_method: 'test',
    allergens: [],
    safety_tags: [],
    nutrition_basis: 'unavailable',
    lab_values_per_serving: null,
    sources: [],
    confidence: 'low',
    needs_expert_review: true,
    notes: [],
    batch_number: 1,
    ...over,
  } as RawDish;
}

/** Returns a profile with the given overrides. */
export function makeProfile(over: Partial<UserProfile> = {}): UserProfile {
  return { ...EMPTY_PROFILE, ...over };
}
