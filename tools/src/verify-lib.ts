import type { Dish, Ingredient, Provenance, SafetyRule, HealthRule } from '@sp/contracts';
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

/** Provenance source_id vocabulary mapped by the approval pipeline to sources.json ids. */
const MAPPED_PROVENANCE_SOURCE_IDS: Record<string, string> = {
  'FCTB-2013': 'bd-fctb-2013',
  'USDA-FDC': 'usda-fdc',
  'IFCT-2017': 'ifct-2017',
};

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

  // Provenance: every source reference resolves, and every present nutrient value
  // carries a per-value source entry (traceability).
  const checkProvenance = (ingredientId: string, provenance: Provenance): void => {
    const raw = provenance.source_id;
    if (input.sourceIds.has(raw)) return;
    const mapped = MAPPED_PROVENANCE_SOURCE_IDS[raw];
    if (mapped !== undefined && input.sourceIds.has(mapped)) return;
    problems.push(
      `ingredient ${ingredientId}: provenance source_id "${raw}" does not resolve to the source register`,
    );
  };
  for (const ingredient of input.ingredients) {
    for (const provenance of ingredient.source) checkProvenance(ingredient.id, provenance);
    for (const key of NUTRIENT_KEYS) {
      if (ingredient[key] === null) continue;
      const provenance = ingredient.nutrient_sources[key];
      if (provenance === undefined)
        problems.push(`ingredient ${ingredient.id}: nutrient ${key} has no source entry`);
      else checkProvenance(ingredient.id, provenance);
    }
    if (ingredient.review_provenance === undefined)
      problems.push(`ingredient ${ingredient.id}: missing review_provenance`);
  }
  for (const dish of input.dishes) {
    if (dish.review_provenance === undefined)
      problems.push(`dish ${dish.id}: missing review_provenance`);
  }

  // Safety rules: sources resolve, message keys resolve. Storage-hour rules are rejected:
  // no authoritative source supports an hour threshold and the UI never captures storage
  // context, so such a rule could never fire honestly.
  for (const rule of input.safetyRules) {
    if (rule.trigger.type === 'storage_hours') {
      problems.push(
        `safety rule ${rule.id}: storage_hours triggers are disabled (no sourced threshold; ` +
          'the UI does not capture hours since cooking) - remove the rule or add a professionally sourced one',
      );
    }
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
