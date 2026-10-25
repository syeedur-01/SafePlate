import { z } from 'zod';
import { NutrientKeySchema } from './knowledge';
import { AllergenSchema, ConditionSchema, RulesStatusSchema } from './vocab';

const NutrientResultSchema = z.object({
  value: z.number().nullable(),
  coverage: z.number().min(0).max(1),
  shown: z.boolean(),
  origin: z.enum(['lab_scaled', 'calculated', 'none']),
});
export const NutritionResultSchema = z.object({
  perServing: z.object({
    energy_kcal: NutrientResultSchema,
    protein_g: NutrientResultSchema,
    fat_g: NutrientResultSchema,
    sat_fat_g: NutrientResultSchema,
    carbs_g: NutrientResultSchema,
    sugars_g: NutrientResultSchema,
    fibre_g: NutrientResultSchema,
    sodium_mg: NutrientResultSchema,
  }),
  overallCoverage: z.number().min(0).max(1),
  missingIngredientIds: z.array(z.string()),
  estimated: z.literal(true),
});
export type NutritionResult = z.infer<typeof NutritionResultSchema>;

export const SafetyResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: z.enum(['low', 'moderate', 'high']),
  signals: z.array(
    z.object({
      ruleId: z.string(),
      labelKey: z.string(),
      points: z.number(),
      evidence: z.string(),
      sourceRef: z.string().nullable(),
    }),
  ),
  mitigationKeys: z.array(z.string()),
  notices: z.array(z.string()).min(1),
  rulesStatus: RulesStatusSchema,
});
export type SafetyResult = z.infer<typeof SafetyResultSchema>;

export const WarningSchema = z.object({
  id: z.string(),
  kind: z.enum(['allergen', 'condition']),
  level: z.enum(['info', 'caution', 'avoid']),
  condition: ConditionSchema.nullable(),
  allergen: AllergenSchema.nullable(),
  messageKey: z.string(),
  params: z.record(z.union([z.string(), z.number()])),
  sourceRef: z.string().nullable(),
});
export type Warning = z.infer<typeof WarningSchema>;

export const SwapSchema = z.object({
  dishId: z.string(),
  improves: z.array(NutrientKeySchema),
  reasonKey: z.string(),
});
export const ShoppingItemSchema = z.object({
  ingredientId: z.string(),
  grams: z.number().positive(),
});

export const AnalysisResultSchema = z.object({
  dishId: z.string().nullable(),
  safety: SafetyResultSchema,
  warnings: z.array(WarningSchema),
  nutrition: NutritionResultSchema.nullable(),
  swaps: z.array(SwapSchema),
  shoppingList: z.array(ShoppingItemSchema),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
