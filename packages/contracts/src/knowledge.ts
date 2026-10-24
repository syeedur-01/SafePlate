import { z } from 'zod';

export const NUTRIENT_KEYS = [
  'energy_kcal',
  'protein_g',
  'fat_g',
  'sat_fat_g',
  'carbs_g',
  'sugars_g',
  'fibre_g',
  'sodium_mg',
] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export const NutrientKeySchema = z.enum(NUTRIENT_KEYS);

export const NutrientValuesSchema = z.object({
  energy_kcal: z.number().nullable(),
  protein_g: z.number().nullable(),
  fat_g: z.number().nullable(),
  sat_fat_g: z.number().nullable(),
  carbs_g: z.number().nullable(),
  sugars_g: z.number().nullable(),
  fibre_g: z.number().nullable(),
  sodium_mg: z.number().nullable(),
});
export type NutrientValues = z.infer<typeof NutrientValuesSchema>;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const provenance = z.object({ source_id: z.string() }).passthrough();

export const IngredientSchema = NutrientValuesSchema.extend({
  id: slug,
  name_en: z.string().min(1),
  name_bn: z.string(),
  basis: z.literal('per_100_g_raw_ingredient'),
  source: z.array(provenance),
  nutrient_sources: z.record(provenance),
  notes: z.string().optional(),
  match_quality: z.enum(['direct', 'proxy']).optional(),
  review_status: z.enum(['draft', 'approved']).optional(),
}).passthrough();
export type Ingredient = z.infer<typeof IngredientSchema>;

export const RawDishSchema = z
  .object({
    id: slug,
    name_en: z.string().min(1),
    name_bn: z.string(),
    aliases: z.array(z.string()),
    category: z.string(),
    serving_description: z.string(),
    serving_weight_g: z.number().positive(),
    serving_weight_basis: z.literal('ESTIMATE'),
    ingredients: z
      .array(
        z.object({
          ingredient_id: slug,
          grams_raw: z.number().positive(),
          quantity_basis: z.enum(['ESTIMATE', 'SOURCE']),
        }),
      )
      .min(1),
    cooking_method: z.string(),
    allergens: z.array(z.string()),
    safety_tags: z.array(z.string()),
    nutrition_basis: z.enum(['lab_analyzed', 'calculated', 'unavailable']),
    lab_values_per_serving: z
      .object({
        value_basis: z.string(),
        values: NutrientValuesSchema,
      })
      .passthrough()
      .nullable(),
    sources: z.array(z.object({ title: z.string() }).passthrough()),
    confidence: z.enum(['low', 'medium', 'high']),
    needs_expert_review: z.boolean(),
    notes: z.array(z.string()),
    batch_number: z.number().int(),
  })
  .passthrough();
export type RawDish = z.infer<typeof RawDishSchema>;

export const RawDishesFileSchema = z.object({
  metadata: z.record(z.unknown()),
  dishes: z.array(RawDishSchema).min(1),
});
export const RawIngredientsFileSchema = z.object({
  metadata: z.record(z.unknown()),
  ingredients: z.array(IngredientSchema).min(1),
});

/** Returns one message per dish ingredient line whose ingredient_id is not in the ingredient list. */
export function findDanglingRefs(dishes: RawDish[], ingredients: Ingredient[]): string[] {
  const known = new Set(ingredients.map((i) => i.id));
  const errors: string[] = [];
  for (const d of dishes) {
    for (const line of d.ingredients) {
      if (!known.has(line.ingredient_id))
        errors.push(`${d.id}: unknown ingredient ${line.ingredient_id}`);
    }
  }
  return errors;
}
