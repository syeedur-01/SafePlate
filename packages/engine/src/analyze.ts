import type {
  AnalysisResult,
  Dish,
  HealthRule,
  Ingredient,
  SafetyRule,
  ScanContext,
  SpoilageSign,
  UserProfile,
} from '@sp/contracts';
import type { AllergenKeywords, LabelInput } from './label';
import { analyzeLabel } from './label';
import { computeNutrition } from './nutrition';
import { scoreSafety } from './safety';
import { buildShoppingList } from './shopping';
import { evaluateSuitability } from './suitability';
import { suggestSwaps } from './swaps';

export interface AnalyzeInput {
  scanKind: 'dish' | 'label';
  dishId: string | null; // required when scanKind is 'dish'
  dishes: Dish[];
  ingredients: Map<string, Ingredient>;
  observations: { spoilageSigns: SpoilageSign[]; imageQuality: 'good' | 'poor' };
  context: ScanContext;
  label: (LabelInput & { expiryDate: string | null }) | null;
  profile: UserProfile;
  safetyRules: SafetyRule[];
  healthRules: HealthRule[];
  allergenKeywords: AllergenKeywords;
  today: string;
  servings?: number; // default 1
}

const EMPTY_LABEL: LabelInput & { expiryDate: string | null } = {
  ingredientsText: null,
  declaredAllergens: [],
  nutritionPer100g: null,
  expiryDate: null,
};

/** Returns the full AnalysisResult for a dish or a label scan, per TECH_DESIGN §4.4. */
export function analyze(input: AnalyzeInput): AnalysisResult {
  const shared = {
    observations: input.observations,
    context: input.context,
    today: input.today,
  };

  if (input.scanKind === 'label') {
    const label = input.label ?? EMPTY_LABEL;
    const { warnings } = analyzeLabel({
      label,
      profile: input.profile,
      rules: input.healthRules,
      keywords: input.allergenKeywords,
    });
    const safety = scoreSafety(
      { ...shared, dishTags: [], label: { expiryDate: label.expiryDate } },
      input.safetyRules,
    );
    return { dishId: null, safety, warnings, nutrition: null, swaps: [], shoppingList: [] };
  }

  const dish = input.dishes.find((candidate) => candidate.id === input.dishId);
  if (!dish) throw new Error(`Unknown dish: ${input.dishId}`);

  const nutrition = computeNutrition(dish, input.ingredients);
  const safety = scoreSafety(
    { ...shared, dishTags: dish.safety_tags, label: null },
    input.safetyRules,
  );
  const warnings = evaluateSuitability({
    profile: input.profile,
    dishAllergens: dish.allergens,
    cookingClass: dish.cooking_class,
    safetyTags: dish.safety_tags,
    nutrition,
    rules: input.healthRules,
  });
  const swaps = suggestSwaps({
    dish,
    profile: input.profile,
    dishes: input.dishes,
    ingredients: input.ingredients,
    rules: input.healthRules,
  });
  const shoppingList = buildShoppingList(dish, input.servings ?? 1);

  return { dishId: dish.id, safety, warnings, nutrition, swaps, shoppingList };
}
