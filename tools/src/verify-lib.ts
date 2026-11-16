import type { Dish, Ingredient, SafetyRule, HealthRule } from '@sp/contracts';
import { NUTRIENT_KEYS } from '@sp/contracts';

/** The data the verify command checks for consistency. */
export interface VerifyInput {
  dishes: Dish[];
  ingredients: Ingredient[];
  safetyRules: SafetyRule[];
  healthRules: HealthRule[];
  messages: Record<string, { en: string; bn: string }>;
  sourceIds: Set<string>;
}

/** Returns human-readable problems. An empty array means everything is consistent. */
export function verifyAll(input: VerifyInput): string[] {
  const problems: string[] = [];

  // Unique dish and ingredient ids.
  const dishIds = new Set<string>();
  for (const dish of input.dishes) {
    if (dishIds.has(dish.id)) problems.push(`duplicate dish id: ${dish.id}`);
    dishIds.add(dish.id);
  }
  const ingredientIds = new Set<string>();
  for (const ingredient of input.ingredients) {
    if (ingredientIds.has(ingredient.id))
      problems.push(`duplicate ingredient id: ${ingredient.id}`);
    ingredientIds.add(ingredient.id);
  }

  // Every dish ingredient reference resolves; serving weight is positive.
  for (const dish of input.dishes) {
    for (const line of dish.ingredients) {
      if (!ingredientIds.has(line.ingredient_id)) {
        problems.push(`dish ${dish.id}: unknown ingredient ${line.ingredient_id}`);
      }
    }
    if (!(dish.serving_weight_g > 0)) {
      problems.push(`dish ${dish.id}: serving_weight_g must be > 0 (got ${dish.serving_weight_g})`);
    }
  }

  // No nutrient value is negative or NaN.
  for (const ingredient of input.ingredients) {
    for (const key of NUTRIENT_KEYS) {
      const value = ingredient[key];
      if (value === null) continue;
      if (Number.isNaN(value)) problems.push(`ingredient ${ingredient.id}: nutrient ${key} is NaN`);
      else if (value < 0)
        problems.push(`ingredient ${ingredient.id}: nutrient ${key} is negative (${value})`);
    }
  }

  // Safety rules: sources resolve, message keys resolve.
  for (const rule of input.safetyRules) {
    if (rule.sourceRef !== null && !input.sourceIds.has(rule.sourceRef)) {
      problems.push(`safety rule ${rule.id}: unknown sourceRef ${rule.sourceRef}`);
    }
    if (!(rule.labelKey in input.messages)) {
      problems.push(`safety rule ${rule.id}: unknown labelKey ${rule.labelKey}`);
    }
    for (const key of rule.mitigationKeys) {
      if (!(key in input.messages)) {
        problems.push(`safety rule ${rule.id}: unknown mitigationKey ${key}`);
      }
    }
  }

  // Health rules: sources resolve, message keys resolve.
  for (const rule of input.healthRules) {
    if (!input.sourceIds.has(rule.sourceRef)) {
      problems.push(`health rule ${rule.id}: unknown sourceRef ${rule.sourceRef}`);
    }
    if (!(rule.messageKey in input.messages)) {
      problems.push(`health rule ${rule.id}: unknown messageKey ${rule.messageKey}`);
    }
  }

  return problems;
}
