import type { AnalysisResult, NutritionResult } from '@sp/contracts';
import { kacchiAnalysis } from './analysis-kacchi';

const HIDDEN = { value: null, coverage: 0, shown: false, origin: 'none' } as const;

const hiddenNutrition: NutritionResult = {
  perServing: {
    energy_kcal: HIDDEN,
    protein_g: HIDDEN,
    fat_g: HIDDEN,
    sat_fat_g: HIDDEN,
    carbs_g: HIDDEN,
    sugars_g: HIDDEN,
    fibre_g: HIDDEN,
    sodium_mg: HIDDEN,
  },
  overallCoverage: 0,
  missingIngredientIds: [
    'white-rice-polished-raw',
    'mutton-moderately-fat-raw',
    'plain-yogurt-unverified',
    'potato-diamond-raw',
    'onion-raw',
    'garlic-raw',
    'ginger-raw-unverified',
    'ghee-cow',
    'saffron-unverified',
    'dried-plum-alubokhara-unverified',
    'whole-spice-mix-unverified',
    'salt',
  ],
  estimated: true,
};

/** Returns the kacchi result with every nutrient hidden, as when no coverage data exists. */
export const unknownNutritionAnalysis: AnalysisResult = {
  ...kacchiAnalysis,
  warnings: [
    {
      id: 'insufficient:hypertension-sodium',
      kind: 'condition',
      level: 'info',
      condition: 'hypertension',
      allergen: null,
      messageKey: 'warn.insufficient_data',
      params: { nutrient: 'sodium_mg' },
      sourceRef: 'bd-dietary-guidelines',
    },
    {
      id: 'insufficient:diabetes-sodium',
      kind: 'condition',
      level: 'info',
      condition: 'diabetes',
      allergen: null,
      messageKey: 'warn.insufficient_data',
      params: { nutrient: 'sodium_mg' },
      sourceRef: 'bd-dietary-guidelines',
    },
  ],
  nutrition: hiddenNutrition,
  swaps: [],
};
