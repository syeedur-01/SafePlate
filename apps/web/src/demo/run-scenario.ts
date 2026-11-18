import type { AnalysisResult, Dish, Ingredient, ScanResult, UserProfile } from '@sp/contracts';
import {
  EMPTY_PROFILE,
  HealthRulesFileSchema,
  NormalizedDishesFileSchema,
  RawIngredientsFileSchema,
  SafetyRulesFileSchema,
  ScanResultSchema,
  AllergenSchema,
  type Allergen,
} from '@sp/contracts';
import { analyze, type AllergenKeywords } from '@sp/engine';
import allergenKeywordsFile from '@sp/knowledge/data/allergen-keywords.json';
import normalizedDishesFile from '@sp/knowledge/data/normalized/dishes.json';
import normalizedIngredientsFile from '@sp/knowledge/data/normalized/ingredients.json';
import healthRulesFile from '@sp/knowledge/data/rules/health-rules.json';
import safetyRulesFile from '@sp/knowledge/data/rules/safety-rules.json';
import kacchiJson from '../../../../fixtures/mock-scan/dish-kacchi-biryani.json';
import mishtiDoiJson from '../../../../fixtures/mock-scan/dish-mishti-doi-spoiled.json';
import shutkiJson from '../../../../fixtures/mock-scan/dish-shutki-bhorta.json';
import labelSnackJson from '../../../../fixtures/mock-scan/label-snack.json';
import type { Scenario } from './scenarios';

// The demo loads the same validated knowledge files as useAnalysis.ts; it cannot reuse that
// module's internals because it is a hook module outside this card's file list.
const DISHES: Dish[] = NormalizedDishesFileSchema.parse(normalizedDishesFile).dishes;
const INGREDIENTS: Map<string, Ingredient> = new Map(
  RawIngredientsFileSchema.parse(normalizedIngredientsFile).ingredients.map((ingredient) => [
    ingredient.id,
    ingredient,
  ]),
);
const SAFETY_RULES = SafetyRulesFileSchema.parse(safetyRulesFile).rules;
const HEALTH_RULES = HealthRulesFileSchema.parse(healthRulesFile).rules;

const FIXTURES: Record<string, ScanResult> = {
  'dish-kacchi-biryani': ScanResultSchema.parse(kacchiJson),
  'dish-mishti-doi-spoiled': ScanResultSchema.parse(mishtiDoiJson),
  'dish-shutki-bhorta': ScanResultSchema.parse(shutkiJson),
  'label-snack': ScanResultSchema.parse(labelSnackJson),
};

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

/** Runs the real engine on a scenario and returns the analysis. today is injected. */
export function runScenario(s: Scenario, today: string): AnalysisResult {
  const scanResult = FIXTURES[s.fixture];
  if (scanResult === undefined) {
    throw new Error(`demo fixture not found: ${s.fixture}`);
  }
  const profile: UserProfile = {
    ...EMPTY_PROFILE,
    conditions: s.profile.conditions,
    allergies: s.profile.allergies,
  };
  const scanKind = scanResult.kind === 'dish' && s.dishId === null ? 'label' : scanResult.kind;

  return analyze({
    scanKind,
    dishId: scanKind === 'dish' ? s.dishId : null,
    dishes: DISHES,
    ingredients: INGREDIENTS,
    observations: {
      spoilageSigns: scanResult.observations.spoilageSigns,
      imageQuality: scanResult.observations.imageQuality,
    },
    context: s.context,
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
    today,
    servings: s.servings,
  });
}
