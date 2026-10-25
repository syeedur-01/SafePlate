import { z } from 'zod';
import { RawDishSchema } from './knowledge';
import { AllergenSchema, SafetyTagSchema, CookingClassSchema } from './vocab';

export const DishSchema = RawDishSchema.extend({
  allergens: z.array(AllergenSchema),
  safety_tags: z.array(SafetyTagSchema),
  cooking_class: CookingClassSchema,
});
export type Dish = z.infer<typeof DishSchema>;
export const NormalizedDishesFileSchema = z.object({
  metadata: z.record(z.unknown()),
  dishes: z.array(DishSchema).min(1),
});
