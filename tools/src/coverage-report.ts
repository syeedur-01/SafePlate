import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeNutrition } from '@sp/engine';
import { ingredientsById } from '@sp/knowledge';
import {
  NormalizedDishesFileSchema,
  RawIngredientsFileSchema,
  type NutrientKey,
} from '@sp/contracts';

const knowledgeDataUrl = new URL('../../packages/knowledge/data/', import.meta.url);
const MIN_COVERAGE = 0.8;

/** Nutrient columns of the report, per the card: energy, protein, fat, carbs, sodium, sat fat, sugars. */
const REPORT_KEYS: NutrientKey[] = [
  'energy_kcal',
  'protein_g',
  'fat_g',
  'carbs_g',
  'sodium_mg',
  'sat_fat_g',
  'sugars_g',
];

const COLUMN_LABELS: Record<NutrientKey, string> = {
  energy_kcal: 'energy',
  protein_g: 'protein',
  fat_g: 'fat',
  carbs_g: 'carbs',
  sodium_mg: 'sodium',
  sat_fat_g: 'satfat',
  sugars_g: 'sugars',
  fibre_g: 'fibre',
};

function writeln(line: string): void {
  process.stdout.write(`${line}\n`);
}

function main(): void {
  const dishes = NormalizedDishesFileSchema.parse(
    JSON.parse(
      readFileSync(fileURLToPath(new URL('normalized/dishes.json', knowledgeDataUrl)), 'utf8'),
    ),
  ).dishes;
  const ingredients = RawIngredientsFileSchema.parse(
    JSON.parse(
      readFileSync(fileURLToPath(new URL('normalized/ingredients.json', knowledgeDataUrl)), 'utf8'),
    ),
  ).ingredients;
  const byId = ingredientsById(ingredients);

  writeln('coverage report (per-serving nutrient coverage per dish; gate: energy coverage >= 0.8)');
  writeln(
    'dish'.padEnd(36) + REPORT_KEYS.map((k) => COLUMN_LABELS[k].padStart(8)).join('') + '   gate',
  );
  let passing = 0;
  for (const dish of dishes) {
    const nutrition = computeNutrition(dish, byId);
    const gate = nutrition.perServing.energy_kcal.coverage >= MIN_COVERAGE;
    if (gate) passing += 1;
    const cells = REPORT_KEYS.map((key) => {
      const entry = nutrition.perServing[key];
      return `${Math.round(entry.coverage * 100)}%`.padStart(8);
    });
    writeln(`${dish.id.padEnd(36)}${cells.join('')}${gate ? '   pass' : '   FAIL'}`);
  }
  writeln(`dishes passing the energy gate: ${passing} of ${dishes.length}`);

  const gramsById = new Map<string, number>();
  for (const dish of dishes) {
    for (const line of dish.ingredients) {
      if (line.ingredient_id === 'water') continue; // engine ignores water in coverage
      gramsById.set(line.ingredient_id, (gramsById.get(line.ingredient_id) ?? 0) + line.grams_raw);
    }
  }
  const missing = ingredients
    .filter((i) => i.energy_kcal === null)
    .map((i) => ({ id: i.id, grams: gramsById.get(i.id) ?? 0 }))
    .sort((a, b) => b.grams - a.grams);
  writeln('ingredients still without an energy value (by total grams across dishes):');
  for (const m of missing) writeln(`  ${m.id.padEnd(36)} ${Math.round(m.grams)} g`);
  writeln('done');
}

main();
