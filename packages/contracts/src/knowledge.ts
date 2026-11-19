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

/**
 * Provenance for one ingredient source or one nutrient value: the registered or mapped
 * source id plus the exact record locator. Extra keys pass through for unstructured detail.
 */
export const ProvenanceSchema = z
  .object({
    source_id: z.string(),
    // Detail fields are `null` when explicitly absent (proposal rows carry nulls), absent
    // from the object when not applicable at all.
    /** FCTB/IFCT-style food code of the matched row. */
    food_code: z.string().nullable().optional(),
    /** USDA FoodData Central numeric FDC ID. */
    fdc_id: z.number().int().nullable().optional(),
    /** Physical PDF page the value was read from. */
    pdf_page: z.number().int().nullable().optional(),
    /** Table name inside the source document ("Proximate composition"). */
    table: z.string().nullable().optional(),
    /** Row label inside the table, when the table does not use food codes. */
    row_name: z.string().nullable().optional(),
    /** USDA record description. */
    description: z.string().nullable().optional(),
    /** Measurement basis of the value ("per 100 g edible portion, raw"). */
    basis: z.string().nullable().optional(),
    /** Preparation state of the measured food ("raw", "boiled", ...). */
    preparation: z.string().nullable().optional(),
  })
  .passthrough();
export type Provenance = z.infer<typeof ProvenanceSchema>;

/**
 * How an ingredient's or dish's content was reviewed. Never claim a professional review
 * that did not happen: `ai_assisted_review` means an external AI panel reviewed the item
 * and a human accepted that output (P2-DH01 record); `human_reviewed` is reserved for a
 * qualified human review.
 */
export const ReviewProvenanceSchema = z.enum([
  'source_verified',
  'ai_assisted_review',
  'human_review_pending',
  'human_reviewed',
]);
export type ReviewProvenance = z.infer<typeof ReviewProvenanceSchema>;

export const IngredientSchema = NutrientValuesSchema.extend({
  id: slug,
  name_en: z.string().min(1),
  name_bn: z.string(),
  basis: z.literal('per_100_g_raw_ingredient'),
  source: z.array(ProvenanceSchema),
  nutrient_sources: z.record(ProvenanceSchema),
  notes: z.string().optional(),
  match_quality: z.enum(['direct', 'proxy']).optional(),
  review_status: z.enum(['draft', 'approved']).optional(),
  review_provenance: ReviewProvenanceSchema.optional(),
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
    review_provenance: ReviewProvenanceSchema.optional(),
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

/**
 * One recognition-catalogue entry: what the vision model may name, independent of
 * whether approved nutrition data exists. `nutrition_dish_id` links to the approved
 * nutrition set, or is null for catalogue-only dishes.
 */
export const CatalogueEntrySchema = z.object({
  id: slug,
  name_en: z.string().min(1),
  name_bn: z.string().min(1).nullable(),
  aliases: z.array(z.string()),
  category: z.string().min(1),
  nutrition_dish_id: slug.nullable(),
  provenance: z.object({
    source: z.string().min(1),
    added: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});
export type CatalogueEntry = z.infer<typeof CatalogueEntrySchema>;

export const CatalogueFileSchema = z.object({
  version: z.number().int().positive(),
  entries: z.array(CatalogueEntrySchema).min(1),
});
export type CatalogueFile = z.infer<typeof CatalogueFileSchema>;

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
