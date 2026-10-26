import type {
  Allergen,
  CookingClass,
  HealthRule,
  NutritionResult,
  SafetyTag,
  UserProfile,
  Warning,
} from '@sp/contracts';
import { allergenWarnings } from './allergens';

/** Returns the user's conditions, dietary nutrition results and health rules turned into ordered warnings, per TECH_DESIGN §4.3. */
export function evaluateSuitability(args: {
  profile: UserProfile;
  dishAllergens: Allergen[];
  cookingClass: CookingClass | null;
  safetyTags: SafetyTag[];
  nutrition: NutritionResult | null;
  rules: HealthRule[];
}): Warning[] {
  const { profile, dishAllergens, cookingClass, safetyTags, nutrition, rules } = args;
  const warnings: Warning[] = [...allergenWarnings(profile.allergies, dishAllergens)];

  for (const rule of rules) {
    if (!profile.conditions.includes(rule.condition)) continue;
    if (rule.kind === 'nutrient') {
      const nutrient = nutrition?.perServing[rule.nutrient];
      const value = nutrient?.value;
      if (!nutrient || !nutrient.shown || value === null || value === undefined) {
        warnings.push({
          id: `insufficient:${rule.id}`,
          kind: 'condition',
          level: 'info',
          condition: rule.condition,
          allergen: null,
          messageKey: 'warn.insufficient_data',
          params: { nutrient: rule.nutrient },
          sourceRef: rule.sourceRef,
        });
        continue;
      }
      const fraction = value / rule.dailyLimit;
      const level =
        fraction >= rule.avoidFraction
          ? 'avoid'
          : fraction >= rule.cautionFraction
            ? 'caution'
            : null;
      if (level === null) continue;
      warnings.push({
        id: rule.id,
        kind: 'condition',
        level,
        condition: rule.condition,
        allergen: null,
        messageKey: rule.messageKey,
        params: { nutrient: rule.nutrient, percent: Math.round(fraction * 100) },
        sourceRef: rule.sourceRef,
      });
    } else {
      const match = rule.match;
      const matched =
        'cookingClasses' in match
          ? cookingClass !== null && match.cookingClasses.includes(cookingClass)
          : safetyTags.some((tag) => match.safetyTags.includes(tag));
      if (!matched) continue;
      warnings.push({
        id: rule.id,
        kind: 'condition',
        level: rule.level,
        condition: rule.condition,
        allergen: null,
        messageKey: rule.messageKey,
        params: {},
        sourceRef: rule.sourceRef,
      });
    }
  }

  const rank = (w: Warning) =>
    w.kind === 'allergen' ? 0 : w.level === 'avoid' ? 1 : w.level === 'caution' ? 2 : 3;
  return warnings.sort((a, b) => rank(a) - rank(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
