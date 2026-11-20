import type { Dish, Ingredient, NutrientKey } from '@sp/contracts';

/** Nutrients shown per ingredient in the For You breakdown, per 100 g raw ingredient. */
export const BREAKDOWN_NUTRIENTS: readonly NutrientKey[] = [
  'energy_kcal',
  'protein_g',
  'fat_g',
  'sodium_mg',
];

export interface BreakdownRow {
  ingredientId: string;
  /** Localized ingredient name; the raw id when no record exists (never an invented name). */
  name: string;
  /** Recipe amount in grams; `estimated` mirrors quantity_basis so the UI can label it. */
  grams: number;
  estimated: boolean;
  /** Per-100 g values; `value` stays null when the composition table has no number. */
  values: Array<{ key: NutrientKey; value: number | null }>;
}

export interface BreakdownSource {
  sourceName: string;
  publisher: string | null;
  year: number | null;
  url: string | null;
}

export interface IngredientBreakdown {
  rows: BreakdownRow[];
  sources: BreakdownSource[];
}

type DishIngredient = Dish['ingredients'][number];

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Returns one row per ingredient line of a dish (localized name, recipe grams and the
 * per-100 g composition values, null when no value exists) plus the unique composition
 * sources behind those values. Missing records yield nulls, never invented numbers.
 */
export function buildIngredientBreakdown(
  dishIngredients: DishIngredient[],
  lang: 'en' | 'bn',
  getIngredient: (id: string) => Ingredient | undefined,
): IngredientBreakdown {
  const rows: BreakdownRow[] = [];
  const sources = new Map<string, BreakdownSource>();

  for (const line of dishIngredients) {
    const ingredient = getIngredient(line.ingredient_id);
    const name =
      lang === 'bn'
        ? ingredient?.name_bn || ingredient?.name_en || line.ingredient_id
        : (ingredient?.name_en ?? line.ingredient_id);

    rows.push({
      ingredientId: line.ingredient_id,
      name,
      grams: line.grams_raw,
      estimated: line.quantity_basis === 'ESTIMATE',
      values: BREAKDOWN_NUTRIENTS.map((key) => ({
        key,
        value: ingredient?.[key] ?? null,
      })),
    });

    for (const src of ingredient?.source ?? []) {
      const sourceName = text(src.source_name) ?? src.source_id;
      const publisher = text(src.publisher);
      const year = typeof src.year === 'number' ? src.year : null;
      const url = text(src.url);
      const dedupeKey = `${sourceName}|${year ?? ''}|${url ?? ''}`;
      if (!sources.has(dedupeKey)) {
        sources.set(dedupeKey, { sourceName, publisher, year, url });
      }
    }
  }

  return { rows, sources: [...sources.values()] };
}
