import { z } from 'zod';
import { ConditionSchema, AllergenSchema } from './vocab';

export const UserProfileSchema = z
  .object({
    conditions: z.array(ConditionSchema),
    allergies: z.array(AllergenSchema),
    language: z.enum(['en', 'bn']),
    consentedAt: z.string().nullable(),
  })
  .strict();
export type UserProfile = z.infer<typeof UserProfileSchema>;
export const EMPTY_PROFILE: UserProfile = {
  conditions: [],
  allergies: [],
  language: 'en',
  consentedAt: null,
};
