import { parse } from 'csv-parse/sync';
import {
  NUTRIENT_KEYS,
  type Ingredient,
  type NutrientKey,
  type NutrientValues,
} from '@sp/contracts';

export const USDA_NUTRIENT_NBR = {
  energy_kcal: '208',
  protein_g: '203',
  fat_g: '204',
  carbs_g: '205',
  sugars_g: '269',
  fibre_g: '291',
  sodium_mg: '307',
  sat_fat_g: '606',
} as const;

export interface UsdaFood {
  fdcId: number;
  description: string;
  values: Partial<Record<NutrientKey, number>>;
}

/** The lowercase substrings a nutrient's row name must contain for its number to be trusted. */
const NBR_NAME_MUST_CONTAIN: Record<NutrientKey, readonly string[]> = {
  energy_kcal: ['energy'],
  protein_g: ['protein'],
  fat_g: ['lipid', 'fat'],
  carbs_g: ['carbohydrate'],
  sugars_g: ['sugars'],
  fibre_g: ['fiber'],
  sodium_mg: ['sodium'],
  sat_fat_g: ['saturated'],
};

interface NutrientCsvRow {
  id: string;
  name: string;
  nutrient_nbr: string;
}

interface FoodCsvRow {
  fdc_id: string;
  description: string;
}

interface FoodNutrientCsvRow {
  fdc_id: string;
  nutrient_id: string;
  amount: string;
}

/** Returns the nutrient-row id that plausibly holds `key`, or null when no row name looks right. */
function verifyAndGetNutrientIds(nutrientRows: NutrientCsvRow[]): Map<string, NutrientKey> {
  const idToKey = new Map<string, NutrientKey>();
  const problems: string[] = [];
  for (const key of NUTRIENT_KEYS) {
    const nbr = Number(USDA_NUTRIENT_NBR[key]);
    const rows = nutrientRows.filter((row) => Number(row.nutrient_nbr) === nbr);
    const accepted = rows.filter((row) =>
      NBR_NAME_MUST_CONTAIN[key].some((part) => row.name.toLowerCase().includes(part)),
    );
    if (rows.length === 0) {
      problems.push(`nutrient_nbr ${nbr} is missing from the nutrient CSV`);
    } else if (accepted.length === 0) {
      problems.push(`nutrient_nbr ${nbr} rows do not look like ${key}: "${rows[0]?.name ?? ''}"`);
    } else {
      for (const row of accepted) idToKey.set(row.id, key);
    }
  }
  if (problems.length > 0) {
    throw new Error(`USDA nutrient mapping changed, stop and verify: ${problems.join('; ')}`);
  }
  return idToKey;
}

/** Parses the CSV texts (food, nutrient, food_nutrient) into foods. Throws if a nutrient number's name does not look right. */
export function parseUsda(
  foodCsv: string,
  nutrientCsv: string,
  foodNutrientCsv: string,
): UsdaFood[] {
  const idToKey = verifyAndGetNutrientIds(parse(nutrientCsv, { columns: true }));
  const foods: UsdaFood[] = [];
  const byFdcId = new Map<number, UsdaFood>();
  for (const row of parse<FoodCsvRow>(foodCsv, { columns: true })) {
    const fdcId = Number(row.fdc_id);
    if (!Number.isInteger(fdcId)) continue;
    const food: UsdaFood = { fdcId, description: row.description, values: {} };
    foods.push(food);
    byFdcId.set(fdcId, food);
  }
  for (const row of parse<FoodNutrientCsvRow>(foodNutrientCsv, { columns: true })) {
    const key = idToKey.get(row.nutrient_id);
    const food = byFdcId.get(Number(row.fdc_id));
    const amount = Number(row.amount);
    if (key === undefined || food === undefined || !Number.isFinite(amount)) continue;
    if (food.values[key] === undefined) food.values[key] = amount; // first row wins, deterministic
  }
  return foods;
}

/** Returns the lowercase word tokens of the query that are at least MIN_WORD_LENGTH chars. */
function queryWords(query: string): string[] {
  return [...new Set((query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 3))];
}

/** Returns the match score of a description against the query words (matched word lengths + raw bonus). */
function scoreDescription(description: string, words: string[]): number {
  const lower = description.toLowerCase();
  let score = 0;
  for (const word of words) {
    // light plural tolerance: USDA spellings use plurals ("Lentils") for singular queries
    if (new RegExp(`\\b${word}(?:s|es)?\\b`).test(lower)) score += word.length;
  }
  if (words.length > 0 && /\braw\b/.test(lower)) score += 0.5; // prefer raw entries slightly
  return score;
}

/** Returns up to `limit` foods whose description matches the query, preferring raw entries, best first. */
export function searchFoods(
  query: string,
  foods: UsdaFood[],
  limit = 5,
): Array<UsdaFood & { score: number }> {
  const words = queryWords(query);
  if (words.length === 0) return [];
  return foods
    .map((food) => ({ food, score: scoreDescription(food.description, words) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.food.description.length - b.food.description.length ||
        a.food.fdcId - b.food.fdcId,
    )
    .slice(0, limit)
    .map((entry) => ({ ...entry.food, score: entry.score }));
}

/** Returns only the null fields of `ing` that `food` can fill; never overwrites a non-null value. */
export function fillablePatch(ing: Ingredient, food: UsdaFood): Partial<NutrientValues> {
  const patch: Partial<NutrientValues> = {};
  for (const key of NUTRIENT_KEYS) {
    if ((ing[key] ?? null) === null && food.values[key] !== undefined) {
      patch[key] = food.values[key];
    }
  }
  return patch;
}
