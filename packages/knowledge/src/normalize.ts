import type { Allergen, CookingClass, Dish, RawDish, SafetyTag } from '@sp/contracts';
import { DishSchema, SafetyTagSchema } from '@sp/contracts';

const ALLERGEN_MAP: ReadonlyMap<string, Allergen> = new Map([
  ['milk', 'milk'],
  ['dairy', 'milk'],
  ['egg', 'egg'],
  ['fish', 'fish'],
  ['crustacean_shellfish', 'crustacean_shellfish'],
  ['shellfish', 'crustacean_shellfish'],
  ['crustacean', 'crustacean_shellfish'],
  ['tree_nuts', 'tree_nuts'],
  ['tree nuts', 'tree_nuts'],
  ['peanuts', 'peanuts'],
  ['peanut', 'peanuts'],
  ['wheat_gluten', 'wheat_gluten'],
  ['gluten', 'wheat_gluten'],
  ['wheat', 'wheat_gluten'],
  ['soy', 'soy'],
  ['sesame', 'sesame'],
  ['mustard', 'mustard'],
]);

/** Maps a raw allergen string to the canonical vocabulary, or null if unknown. */
export function normalizeAllergen(raw: string): Allergen | null {
  return ALLERGEN_MAP.get(raw.toLowerCase()) ?? null;
}

/** Returns the cooking class for a free-text cooking method (ordered rules, first match wins). */
export function classifyCooking(method: string): CookingClass {
  const t = method.toLowerCase();
  if (t.includes('steam')) return 'steamed';
  if (t.includes('milk') && (t.includes('sweetened') || t.includes('reduced')))
    return 'sweet_milk_based';
  if (t.includes('ferment') || t.includes('soaked')) return 'fermented';
  if (t.includes('deep') && !t.includes('shallow')) return 'deep_fried';
  if (t.includes('fried') || t.includes('fry') || t.includes('sauté')) return 'shallow_fried';
  if (
    t.includes('braised') ||
    t.includes('simmer') ||
    t.includes('curry') ||
    t.includes('gravy') ||
    t.includes('slow-cooked') ||
    t.includes('stew') ||
    t.includes('layered')
  )
    return 'braised_or_curry';
  if (t.includes('boiled')) return 'boiled_or_simmered';
  if (t.includes('baked') || t.includes('roasted')) return 'baked_or_roasted';
  if (t.includes('mashed')) return 'mashed_or_raw';
  return 'mixed_or_other';
}

/** Returns the dish with canonical allergens (deduplicated), validated safety tags and a cooking class. Throws with the dish id on an unknown allergen or tag. */
export function normalizeDish(d: RawDish): Dish {
  const allergens: Allergen[] = [];
  for (const a of d.allergens) {
    const canon = normalizeAllergen(a);
    if (canon === null) throw new Error(`${d.id}: unknown allergen "${a}"`);
    if (!allergens.includes(canon)) allergens.push(canon);
  }
  const safetyTags: Array<SafetyTag> = [];
  for (const tag of d.safety_tags) {
    const tagCheck = SafetyTagSchema.safeParse(tag);
    if (!tagCheck.success) {
      throw new Error(`${d.id}: unknown safety tag "${tag}"`);
    }
    safetyTags.push(tagCheck.data);
  }
  const candidate: Dish = {
    ...d,
    allergens,
    safety_tags: safetyTags,
    cooking_class: classifyCooking(d.cooking_method),
  };
  const parsed = DishSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(`${d.id}: normalized dish failed DishSchema: ${parsed.error.message}`);
  }
  return parsed.data;
}
