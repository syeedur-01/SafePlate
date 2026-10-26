import type {
  AnalysisResult,
  Dish,
  HealthRule,
  Ingredient,
  NutrientKey,
  UserProfile,
} from '@sp/contracts';
import { allergenConflicts } from './allergens';
import { computeNutrition } from './nutrition';
import { evaluateSuitability } from './suitability';

type Swap = AnalysisResult['swaps'][number];

export const MIN_IMPROVEMENT = 0.2; // the swap must be at least 20 percent lower
const DEFAULT_LIMIT = 3;

interface RankedSwap {
  swap: Swap;
  relativeImprovement: number;
}

/** Returns up to `limit` other dishes that lower every flagged nutrient by at least 20 percent, best first. */
export function suggestSwaps(args: {
  dish: Dish;
  profile: UserProfile;
  dishes: Dish[];
  ingredients: Map<string, Ingredient>;
  rules: HealthRule[];
  limit?: number;
}): Swap[] {
  const { dish, profile, dishes, ingredients, rules } = args;
  const limit = args.limit ?? DEFAULT_LIMIT;
  const current = computeNutrition(dish, ingredients);

  const flagged: { nutrient: NutrientKey; value: number }[] = [];
  for (const rule of rules) {
    if (rule.kind !== 'nutrient' || !profile.conditions.includes(rule.condition)) continue;
    if (flagged.some((f) => f.nutrient === rule.nutrient)) continue;
    const entry = current.perServing[rule.nutrient];
    if (!entry.shown || entry.value === null) continue;
    if (entry.value / rule.dailyLimit < rule.cautionFraction) continue;
    flagged.push({ nutrient: rule.nutrient, value: entry.value });
  }
  if (flagged.length === 0) return [];

  const ranked: RankedSwap[] = [];
  for (const candidate of dishes) {
    if (candidate.id === dish.id) continue;
    if (allergenConflicts(profile.allergies, candidate.allergens).length > 0) continue;

    const nutrition = computeNutrition(candidate, ingredients);
    const improves: NutrientKey[] = [];
    let relativeImprovement = 0;
    let qualifies = true;
    for (const { nutrient, value } of flagged) {
      const entry = nutrition.perServing[nutrient];
      if (!entry.shown || entry.value === null || value <= 0) {
        qualifies = false;
        break;
      }
      const relative = (value - entry.value) / value;
      if (relative < MIN_IMPROVEMENT) {
        qualifies = false;
        break;
      }
      improves.push(nutrient);
      relativeImprovement = Math.max(relativeImprovement, relative);
    }
    if (!qualifies) continue;

    const warnings = evaluateSuitability({
      profile,
      dishAllergens: candidate.allergens,
      cookingClass: candidate.cooking_class,
      safetyTags: candidate.safety_tags,
      nutrition,
      rules,
    });
    if (warnings.some((warning) => warning.level === 'avoid')) continue;

    ranked.push({
      swap: { dishId: candidate.id, improves, reasonKey: 'swap.lower_nutrient' },
      relativeImprovement,
    });
  }

  ranked.sort(
    (a, b) =>
      b.swap.improves.length - a.swap.improves.length ||
      b.relativeImprovement - a.relativeImprovement ||
      (a.swap.dishId < b.swap.dishId ? -1 : a.swap.dishId > b.swap.dishId ? 1 : 0),
  );
  return ranked.slice(0, Math.max(0, limit)).map((r) => r.swap);
}
