import { z } from 'zod';
import { NutrientKeySchema } from './knowledge';
import {
  SpoilageSignSchema,
  SafetyTagSchema,
  ConditionSchema,
  CookingClassSchema,
  RulesStatusSchema,
} from './vocab';

export const SafetyTriggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('spoilage_sign'), sign: SpoilageSignSchema }),
  z.object({
    type: z.literal('storage_hours'),
    storage: z.enum(['room_temp', 'refrigerated']),
    minHours: z.number().min(0),
    tags: z.array(SafetyTagSchema).optional(),
  }),
  z.object({
    type: z.literal('dish_tag'),
    tag: SafetyTagSchema,
    place: z.enum(['home', 'restaurant', 'street', 'packaged', 'unknown']).optional(),
  }),
  z.object({ type: z.literal('label_expired') }),
]);
export const SafetyRuleSchema = z.object({
  id: z.string(),
  trigger: SafetyTriggerSchema,
  points: z.number().int().min(1).max(100),
  labelKey: z.string(),
  mitigationKeys: z.array(z.string()),
  sourceRef: z.string().nullable(),
  status: RulesStatusSchema,
  basis: z.string().optional(), // short paraphrase of what the cited source says, with section or page
});
export const SafetyRulesFileSchema = z.object({ rules: z.array(SafetyRuleSchema) });
export type SafetyRule = z.infer<typeof SafetyRuleSchema>;

export const NutrientRuleSchema = z
  .object({
    kind: z.literal('nutrient'),
    id: z.string(),
    condition: ConditionSchema,
    nutrient: NutrientKeySchema,
    dailyLimit: z.number().positive(),
    cautionFraction: z.number().min(0).max(1),
    avoidFraction: z.number().min(0).max(1),
    messageKey: z.string(),
    sourceRef: z.string(),
    status: RulesStatusSchema,
    basis: z.string().optional(),
  })
  .refine((r) => r.avoidFraction >= r.cautionFraction, {
    message: 'avoidFraction must be >= cautionFraction',
  });
export const TagRuleSchema = z.object({
  kind: z.literal('tag'),
  id: z.string(),
  condition: ConditionSchema,
  match: z.union([
    z.object({ cookingClasses: z.array(CookingClassSchema).min(1) }),
    z.object({ safetyTags: z.array(SafetyTagSchema).min(1) }),
  ]),
  level: z.enum(['info', 'caution']),
  messageKey: z.string(),
  sourceRef: z.string(),
  status: RulesStatusSchema,
  basis: z.string().optional(),
});
export const HealthRulesFileSchema = z.object({
  rules: z.array(z.union([NutrientRuleSchema, TagRuleSchema])),
});
export type NutrientRule = z.infer<typeof NutrientRuleSchema>;
export type TagRule = z.infer<typeof TagRuleSchema>;
export type HealthRule = NutrientRule | TagRule;

export const SourceEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  year: z.number().int().nullable(),
  edition: z.string().nullable(),
  url: z.string().url(),
  tier: z.enum(['bangladesh', 'global', 'professional', 'data']),
  status: z.enum(['verified', 'unverified']),
  accessedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  notes: z.string().optional(),
});
export const SourcesFileSchema = z.object({ sources: z.array(SourceEntrySchema) });
export type SourceEntry = z.infer<typeof SourceEntrySchema>;

/** messageKey to text in both languages. Placeholders look like {name}. */
export const MessagesFileSchema = z.record(
  z.object({ en: z.string().min(1), bn: z.string().min(1) }),
);
export type Messages = z.infer<typeof MessagesFileSchema>;
