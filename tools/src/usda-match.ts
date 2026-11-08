import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getRawIngredients } from '@sp/knowledge';
import type { NutrientKey } from '@sp/contracts';
import { fillablePatch, parseUsda, searchFoods, type UsdaFood } from './usda-lib';

const USDA_ROOT_URL = new URL('../../data/raw/usda/', import.meta.url);
const PROPOSALS_URL = new URL(
  '../../packages/knowledge/data/proposals/usda-matches.json',
  import.meta.url,
);
const DATASET_DIRS = ['sr-legacy', 'foundation-foods'] as const;

/** Returns the three USDA CSV texts of a FoodData Central snapshot directory. */
function readDatasetCsvs(losslessDir: string): {
  food: string;
  nutrient: string;
  foodNutrient: string;
} {
  const readFile = (name: string): string =>
    readFileSync(fileURLToPath(new URL(`${losslessDir}/${name}`, USDA_ROOT_URL)), 'utf8');
  return {
    food: readFile('food.csv'),
    nutrient: readFile('nutrient.csv'),
    foodNutrient: readFile('food_nutrient.csv'),
  };
}

/** Finds the extracted FoodData Central snapshot directory inside one of the dataset folders. */
function snapshotDir(dataSet: string): string {
  const entries = readdirSync(fileURLToPath(new URL(dataSet, USDA_ROOT_URL)));
  const dir = entries.find((entry) => {
    try {
      return statSync(fileURLToPath(new URL(`${dataSet}/${entry}`, USDA_ROOT_URL))).isDirectory();
    } catch {
      return false;
    }
  });
  if (dir === undefined) {
    throw new Error(`no extracted FoodData Central directory under data/raw/usda/${dataSet}/`);
  }
  return `${dataSet}/${dir}`;
}

/** Function words that must not count as distinctive query text. */
const STOPWORDS = new Set(['the', 'and', 'with', 'of', 'in', 'or', 'for']);

/** Returns the query text of a name after removing parenthetical editorial annotations. */
function queryText(name: string): string {
  return name.replace(/[(][^)]*[)]/g, ' ');
}

/** Returns the lowercase distinctive words of the query (same tokenizer as searchFoods minus stopwords). */
function queryWords(name: string): string[] {
  return [
    ...new Set(
      (
        queryText(name)
          .toLowerCase()
          .match(/[a-z0-9]+/g) ?? []
      ).filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  ];
}

/**
 * True when the candidate matched strictly more than half of the query's distinctive text;
 * a single generic word (for example "fish" for a local species) never counts, so no match is forced.
 */
function isSensible(score: number, words: string[]): boolean {
  const totalWeight = words.reduce((sum, word) => sum + word.length, 0);
  return totalWeight > 0 && score > totalWeight / 2;
}

function writeln(line: string): void {
  process.stdout.write(`${line}\n`);
}

function main(): void {
  const foods: UsdaFood[] = [];
  for (const dataSet of DATASET_DIRS) {
    const csvs = readDatasetCsvs(snapshotDir(dataSet));
    foods.push(...parseUsda(csvs.food, csvs.nutrient, csvs.foodNutrient));
  }
  writeln(`parsed USDA foods: ${foods.length}`);
  const ingredients = getRawIngredients();
  const NULLABLE_KEYS: readonly NutrientKey[] = [
    'energy_kcal',
    'protein_g',
    'fat_g',
    'sat_fat_g',
    'carbs_g',
    'sugars_g',
    'fibre_g',
    'sodium_mg',
  ];
  const proposals = [];
  let withCandidates = 0;
  const withoutCandidates: string[] = [];
  for (const ingredient of ingredients) {
    const hasNull = NULLABLE_KEYS.some((key) => (ingredient[key] ?? null) === null);
    if (!hasNull) continue;
    const words = queryWords(ingredient.name_en);
    const candidates = searchFoods(ingredient.name_en, foods).filter((c) =>
      isSensible(c.score, words),
    );
    if (candidates.length > 0) withCandidates += 1;
    else withoutCandidates.push(`${ingredient.id} (${ingredient.name_en})`);
    proposals.push({
      ingredientId: ingredient.id,
      candidates: candidates.map((c) => ({
        fdcId: c.fdcId,
        description: c.description,
        patch: fillablePatch(ingredient, c),
        score: c.score,
      })),
      matchQuality: 'proxy',
      approvedFdcId: null,
    });
  }
  writeFileSync(fileURLToPath(PROPOSALS_URL), `${JSON.stringify(proposals, null, 2)}\n`, 'utf8');
  writeln(
    `proposals written: ${proposals.length} ingredients with null fields, ${withCandidates} with sensible candidates, ` +
      `${withoutCandidates.length} with none (local or no USDA equivalent; left empty on purpose)`,
  );
  writeln(
    `file: ${fileURLToPath(PROPOSALS_URL)} (${statSync(fileURLToPath(PROPOSALS_URL)).size} bytes)`,
  );
  for (const id of withoutCandidates) writeln(`  no candidate: ${id}`);
}

main();
