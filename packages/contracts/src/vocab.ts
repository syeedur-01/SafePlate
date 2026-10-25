import { z } from 'zod';

export const AllergenSchema = z.enum([
  'milk',
  'egg',
  'fish',
  'crustacean_shellfish',
  'tree_nuts',
  'peanuts',
  'wheat_gluten',
  'soy',
  'sesame',
  'mustard',
]);
export type Allergen = z.infer<typeof AllergenSchema>;

export const ConditionSchema = z.enum(['diabetes', 'hypertension', 'high_cholesterol', 'gastric']);
export type Condition = z.infer<typeof ConditionSchema>;

export const SafetyTagSchema = z.enum([
  'dairy',
  'seafood',
  'fried',
  'raw-ingredient',
  'street-food',
  'fermented',
]);
export type SafetyTag = z.infer<typeof SafetyTagSchema>;

export const SPOILAGE_SIGNS = [
  'visible_mold',
  'slimy_surface',
  'discoloration',
  'bloated_packaging',
  'leaking_packaging',
  'separated_liquid',
  'foam_or_bubbles',
  'foreign_object',
] as const;
export const SpoilageSignSchema = z.enum(SPOILAGE_SIGNS);
export type SpoilageSign = z.infer<typeof SpoilageSignSchema>;

export const CookingClassSchema = z.enum([
  'deep_fried',
  'shallow_fried',
  'braised_or_curry',
  'boiled_or_simmered',
  'steamed',
  'baked_or_roasted',
  'mashed_or_raw',
  'fermented',
  'sweet_milk_based',
  'mixed_or_other',
]);
export type CookingClass = z.infer<typeof CookingClassSchema>;

export const RulesStatusSchema = z.enum(['draft', 'approved']);
