import type {
  Allergen,
  HealthRule,
  NutrientKey,
  NutritionResult,
  NutrientValues,
  UserProfile,
  Warning,
} from '@sp/contracts';
import { NUTRIENT_KEYS } from '@sp/contracts';
import { evaluateSuitability } from './suitability';

export type AllergenKeywords = Record<Allergen, string[]>; // lowercase words or phrases; matched as whole tokens (Bangla and Latin), never inside a longer word

/** Splits text into lowercase letter/number tokens (Unicode-aware, and combining marks stay attached so Bangla words keep their vowel signs). */
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

/** Returns true when the keyword's token sequence appears as consecutive tokens (punctuation between them is fine). */
function keywordMatches(keyword: string, tokens: string[]): boolean {
  const kt = tokenize(keyword);
  if (kt.length === 0) return false;
  outer: for (let i = 0; i + kt.length <= tokens.length; i++) {
    for (let j = 0; j < kt.length; j++) {
      if (tokens[i + j] !== kt[j]) continue outer;
    }
    return true;
  }
  return false;
}
export interface LabelInput {
  ingredientsText: string | null;
  declaredAllergens: Allergen[];
  nutritionPer100g: Partial<NutrientValues> | null;
}
export interface DetectedAllergen {
  allergen: Allergen;
  via: 'declared' | 'ingredients';
}

/** Returns declared allergens plus any allergen whose keyword appears as whole tokens in the ingredients text (case-insensitive). Declared wins when both apply. */
export function detectAllergens(
  label: Pick<LabelInput, 'ingredientsText' | 'declaredAllergens'>,
  keywords: AllergenKeywords,
): DetectedAllergen[] {
  const detected: DetectedAllergen[] = [];
  const seen = new Set<Allergen>();

  for (const allergen of label.declaredAllergens) {
    if (seen.has(allergen)) continue;
    seen.add(allergen);
    detected.push({ allergen, via: 'declared' });
  }

  const text = label.ingredientsText?.toLowerCase() ?? '';
  if (text.length === 0) return detected;
  const tokens = tokenize(text);
  for (const allergen of Object.keys(keywords) as Allergen[]) {
    if (seen.has(allergen)) continue;
    if (!keywords[allergen].some((word) => keywordMatches(word, tokens))) continue;
    seen.add(allergen);
    detected.push({ allergen, via: 'ingredients' });
  }
  return detected;
}

/** Returns warnings: allergen conflicts first (params allergen and via), then nutrient-rule warnings evaluated per 100 g (params basis 'per_100g'). */
export function analyzeLabel(args: {
  label: LabelInput;
  profile: UserProfile;
  rules: HealthRule[];
  keywords: AllergenKeywords;
}): { warnings: Warning[]; detected: DetectedAllergen[] } {
  const { label, profile, rules, keywords } = args;
  const detected = detectAllergens(label, keywords);

  const allergenConflicts: Warning[] = detected
    .filter((d) => profile.allergies.includes(d.allergen))
    .map((d) => ({
      id: `allergen:${d.allergen}`,
      kind: 'allergen',
      level: 'avoid',
      condition: null,
      allergen: d.allergen,
      messageKey: 'warn.allergen_present',
      params: { allergen: d.allergen, via: d.via },
      sourceRef: null,
    }));

  const nutrientWarnings = evaluateSuitability({
    profile,
    dishAllergens: [],
    cookingClass: null,
    safetyTags: [],
    nutrition: labelNutrition(label.nutritionPer100g),
    rules,
  }).map((warning) => ({ ...warning, params: { ...warning.params, basis: 'per_100g' as const } }));

  return { warnings: [...allergenConflicts, ...nutrientWarnings], detected };
}

/** Returns a NutritionResult from the label's per-100 g values; absent nutrients are `shown: false`, never zero. */
function labelNutrition(values: Partial<NutrientValues> | null): NutritionResult {
  const entry = (nutrient: NutrientKey): NutritionResult['perServing'][NutrientKey] => {
    const value = values?.[nutrient];
    if (value === null || value === undefined) {
      return { value: null, coverage: 0, shown: false, origin: 'none' };
    }
    return { value, coverage: 1, shown: true, origin: 'calculated' };
  };

  const perServing = {
    energy_kcal: entry('energy_kcal'),
    protein_g: entry('protein_g'),
    fat_g: entry('fat_g'),
    sat_fat_g: entry('sat_fat_g'),
    carbs_g: entry('carbs_g'),
    sugars_g: entry('sugars_g'),
    fibre_g: entry('fibre_g'),
    sodium_mg: entry('sodium_mg'),
  };
  const present = NUTRIENT_KEYS.filter((nutrient) => perServing[nutrient].shown).length;

  return {
    perServing,
    overallCoverage: present / NUTRIENT_KEYS.length,
    missingIngredientIds: [],
    estimated: true,
  };
}
