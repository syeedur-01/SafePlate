import { z } from 'zod';
import { NutrientValuesSchema } from './knowledge';
import { SpoilageSignSchema, AllergenSchema } from './vocab';

export const ScanContextSchema = z
  .object({
    place: z.enum(['home', 'restaurant', 'street', 'packaged', 'unknown']),
    storage: z.enum(['fresh_just_made', 'room_temp', 'refrigerated', 'unknown']),
    hoursSinceCooked: z.number().min(0).max(240).nullable(),
  })
  .strict();
export type ScanContext = z.infer<typeof ScanContextSchema>;

export const ScanRequestSchema = z
  .object({
    kind: z.enum(['dish', 'label']),
    imageBase64: z.string().min(100).max(1_800_000),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    context: ScanContextSchema,
  })
  .strict(); // strict on purpose: the profile must never be accepted
export type ScanRequest = z.infer<typeof ScanRequestSchema>;

const ObservationsSchema = z.object({
  spoilageSigns: z.array(SpoilageSignSchema),
  imageQuality: z.enum(['good', 'poor']),
  notes: z.string().max(300),
});

export const DishScanResultSchema = z.object({
  kind: z.literal('dish'),
  candidates: z
    .array(
      z.object({
        dishId: z.string().nullable(),
        label: z.string(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .min(1)
    .max(3),
  observations: ObservationsSchema,
  provider: z.string(),
  cached: z.boolean(),
});

export const LabelScanResultSchema = z.object({
  kind: z.literal('label'),
  productName: z.string().nullable(),
  ingredientsText: z.string().nullable(),
  declaredAllergens: z.array(AllergenSchema),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  nutritionPer100g: NutrientValuesSchema.partial().nullable(),
  observations: ObservationsSchema,
  provider: z.string(),
  cached: z.boolean(),
});

export const ScanResultSchema = z.discriminatedUnion('kind', [
  DishScanResultSchema,
  LabelScanResultSchema,
]);
export type ScanResult = z.infer<typeof ScanResultSchema>;
export type DishScanResult = z.infer<typeof DishScanResultSchema>;
export type LabelScanResult = z.infer<typeof LabelScanResultSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      'bad_request',
      'too_large',
      'ai_unavailable',
      'ai_invalid_output',
      'rate_limited',
      'internal',
    ]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
