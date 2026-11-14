import type { NutrientKey } from '@sp/contracts';

export const NUTRIENT_DISPLAY: Record<
  NutrientKey,
  { labelKey: string; unit: string; decimals: number }
> = {
  energy_kcal: { labelKey: 'nutrient.energy_kcal', unit: 'kcal', decimals: 0 },
  protein_g: { labelKey: 'nutrient.protein_g', unit: 'g', decimals: 1 },
  fat_g: { labelKey: 'nutrient.fat_g', unit: 'g', decimals: 1 },
  sat_fat_g: { labelKey: 'nutrient.sat_fat_g', unit: 'g', decimals: 1 },
  carbs_g: { labelKey: 'nutrient.carbs_g', unit: 'g', decimals: 1 },
  sugars_g: { labelKey: 'nutrient.sugars_g', unit: 'g', decimals: 1 },
  fibre_g: { labelKey: 'nutrient.fibre_g', unit: 'g', decimals: 1 },
  sodium_mg: { labelKey: 'nutrient.sodium_mg', unit: 'mg', decimals: 0 },
};

/** Returns the number formatted for display, e.g. 435 or 12.5. */
export function formatNutrient(key: NutrientKey, value: number): string {
  return value.toFixed(NUTRIENT_DISPLAY[key].decimals);
}
