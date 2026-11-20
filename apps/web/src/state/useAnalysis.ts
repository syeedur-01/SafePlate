import { useMemo } from 'react';
import type {
  AnalysisResult,
  Allergen,
  Dish,
  Ingredient,
  ScanContext,
  ScanResult,
  UserProfile,
} from '@sp/contracts';
import {
  AllergenSchema,
  HealthRulesFileSchema,
  NormalizedDishesFileSchema,
  RawIngredientsFileSchema,
  SafetyRulesFileSchema,
} from '@sp/contracts';
import { analyze, type AllergenKeywords, type AllergenMatching } from '@sp/engine';
import allergenKeywordsFile from '@sp/knowledge/data/allergen-keywords.json';
import allergenMatchingFile from '@sp/knowledge/data/allergen-matching.json';
import normalizedDishesFile from '@sp/knowledge/data/normalized/dishes.json';
import normalizedIngredientsFile from '@sp/knowledge/data/normalized/ingredients.json';
import healthRulesFile from '@sp/knowledge/data/rules/health-rules.json';
import safetyRulesFile from '@sp/knowledge/data/rules/safety-rules.json';

// The @sp/knowledge getters read with node:fs, which a browser bundle cannot run, so the
// browser reads the same validated files directly.
const DISHES: Dish[] = NormalizedDishesFileSchema.parse(normalizedDishesFile).dishes;
const INGREDIENTS: Map<string, Ingredient> = new Map(
  RawIngredientsFileSchema.parse(normalizedIngredientsFile).ingredients.map((ingredient) => [
    ingredient.id,
    ingredient,
  ]),
);
const SAFETY_RULES = SafetyRulesFileSchema.parse(safetyRulesFile).rules;
const HEALTH_RULES = HealthRulesFileSchema.parse(healthRulesFile).rules;

/** Returns the validated ingredient record for an id, or undefined when there is none. */
export function getIngredient(id: string): Ingredient | undefined {
  return INGREDIENTS.get(id);
}

const ALLERGENS = AllergenSchema.options as readonly Allergen[];

/** Returns the validated allergen keyword lists from the same file the knowledge loader uses. */
function buildAllergenKeywords(raw: unknown): AllergenKeywords {
  const file = raw as Record<string, unknown>;
  const keywords = {} as AllergenKeywords;
  for (const allergen of ALLERGENS) {
    const words = file[allergen];
    if (!Array.isArray(words) || words.length === 0) {
      throw new Error(`allergen-keywords.json is missing keywords for "${allergen}"`);
    }
    for (const word of words) {
      if (typeof word !== 'string' || word.length === 0) {
        throw new Error(`allergen-keywords.json has an invalid keyword for "${allergen}"`);
      }
    }
    keywords[allergen] = words.map((word) => String(word));
  }
  return keywords;
}

const ALLERGEN_KEYWORDS = buildAllergenKeywords(allergenKeywordsFile);

/** Returns the validated allergen matching context rules from the same file the knowledge loader uses. */
function buildAllergenMatching(raw: unknown): AllergenMatching {
  const file = raw as Record<string, unknown>;
  const perAllergen = (value: unknown): Record<string, string[]> => {
    const result: Record<string, string[]> = {};
    if (typeof value === 'object' && value !== null) {
      for (const [allergen, list] of Object.entries(value)) result[allergen] = list as string[];
    }
    return result;
  };
  return {
    uncertain: perAllergen(file.uncertain) as AllergenMatching['uncertain'],
    suppress: perAllergen(file.suppress) as AllergenMatching['suppress'],
    advisoryPhrases: (file.advisoryPhrases ?? []) as string[],
    negationBefore: (file.negationBefore ?? []) as string[],
    negationAfter: (file.negationAfter ?? []) as string[],
  };
}

const ALLERGEN_MATCHING = buildAllergenMatching(allergenMatchingFile);
const DEFAULT_CONTEXT: ScanContext = {
  place: 'unknown',
  storage: 'unknown',
  hoursSinceCooked: null,
};

export interface UseAnalysisArgs {
  scanResult: ScanResult;
  dishId: string | null;
  servings: number;
  profile: UserProfile;
  now: () => Date;
}

/** Returns the dish record for an id from the same knowledge data the analysis uses. */
export function getDish(dishId: string | null): Dish | null {
  if (dishId === null) return null;
  return DISHES.find((dish) => dish.id === dishId) ?? null;
}

/** Returns the UTC calendar day as YYYY-MM-DD, the format the rules expect for expiry dates. */
function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Returns the deterministic analysis for a scan, the chosen dish, servings and the on-device profile. */
export function useAnalysis(args: UseAnalysisArgs): AnalysisResult {
  const { scanResult, dishId, servings, profile, now } = args;

  return useMemo(() => {
    // "None of these" leaves a dish scan without a dish; only photo-visible safety can be judged.
    const scanKind = scanResult.kind === 'dish' && dishId === null ? 'label' : scanResult.kind;
    return analyze({
      scanKind,
      dishId: scanKind === 'dish' ? dishId : null,
      dishes: DISHES,
      ingredients: INGREDIENTS,
      observations: {
        spoilageSigns: scanResult.observations.spoilageSigns,
        imageQuality: scanResult.observations.imageQuality,
      },
      context: DEFAULT_CONTEXT,
      label:
        scanKind === 'label' && scanResult.kind === 'label'
          ? {
              ingredientsText: scanResult.ingredientsText,
              declaredAllergens: scanResult.declaredAllergens,
              nutritionPer100g: scanResult.nutritionPer100g,
              expiryDate: scanResult.expiryDate,
            }
          : null,
      profile,
      safetyRules: SAFETY_RULES,
      healthRules: HEALTH_RULES,
      allergenKeywords: ALLERGEN_KEYWORDS,
      allergenMatching: ALLERGEN_MATCHING,
      today: utcDate(now()),
      servings,
    });
  }, [scanResult, dishId, servings, profile, now]);
}
