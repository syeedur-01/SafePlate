import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getRawDishes, getRawIngredients, normalizeDish } from '@sp/knowledge';
import {
  NormalizedDishesFileSchema,
  RawIngredientsFileSchema,
  type Ingredient,
  type Dish,
} from '@sp/contracts';

const NUTRIENT_KEYS = [
  'energy_kcal',
  'protein_g',
  'fat_g',
  'sat_fat_g',
  'carbs_g',
  'sugars_g',
  'fibre_g',
  'sodium_mg',
] as const;

/** Returns the 8 nutrient values of an ingredient, nothing else. */
function nutrientSubset(i: Ingredient): Record<(typeof NUTRIENT_KEYS)[number], number | null> {
  return {
    energy_kcal: i.energy_kcal,
    protein_g: i.protein_g,
    fat_g: i.fat_g,
    sat_fat_g: i.sat_fat_g,
    carbs_g: i.carbs_g,
    sugars_g: i.sugars_g,
    fibre_g: i.fibre_g,
    sodium_mg: i.sodium_mg,
  };
}

/** Returns the slim dish record used in the browser. */
function runtimeDish(d: Dish) {
  return {
    id: d.id,
    name_en: d.name_en,
    name_bn: d.name_bn,
    aliases: d.aliases,
    category: d.category,
    serving_description: d.serving_description,
    serving_weight_g: d.serving_weight_g,
    ingredients: d.ingredients,
    allergens: d.allergens,
    safety_tags: d.safety_tags,
    cooking_class: d.cooking_class,
    nutrition_basis: d.nutrition_basis,
    lab_values_per_serving: d.lab_values_per_serving
      ? {
          value_basis: d.lab_values_per_serving.value_basis,
          values: d.lab_values_per_serving.values,
        }
      : null,
  };
}

/** Returns the slim ingredient record used in the browser. */
function runtimeIngredient(i: Ingredient) {
  return {
    id: i.id,
    name_en: i.name_en,
    name_bn: i.name_bn,
    ...nutrientSubset(i),
    ...(i.match_quality !== undefined ? { match_quality: i.match_quality } : {}),
  };
}

function writeln(line: string): void {
  process.stdout.write(`${line}\n`);
}

function main(): void {
  const rawDishes = getRawDishes();
  const rawIngredients = getRawIngredients();
  const normalizedDishes = rawDishes.map((d) => normalizeDish(d));

  const normalizedDishesFile = NormalizedDishesFileSchema.parse({
    metadata: {
      source: 'data/source/dishes.json (never edited)',
      generator: 'pnpm --filter @sp/tools normalize (tools/src/normalize-data.ts)',
    },
    dishes: normalizedDishes,
  });
  const normalizedIngredientsFile = RawIngredientsFileSchema.parse({
    metadata: {
      source: 'data/source/ingredients.json (never edited)',
      generator: 'pnpm --filter @sp/tools normalize (tools/src/normalize-data.ts)',
    },
    ingredients: rawIngredients,
  });
  const runtime = {
    dishes: normalizedDishes.map(runtimeDish),
    ingredients: rawIngredients.map(runtimeIngredient),
  };
  const cookingClasses = rawDishes.map((d) => {
    const n = normalizedDishes.find((x) => x.id === d.id);
    return { dishId: d.id, method: d.cooking_method, cookingClass: n ? n.cooking_class : null };
  });

  const knowledgeDataUrl = new URL('../../packages/knowledge/data/', import.meta.url);
  const targets: Array<{ dir: URL; file: string; body: unknown }> = [
    {
      dir: new URL('normalized/', knowledgeDataUrl),
      file: 'dishes.json',
      body: normalizedDishesFile,
    },
    {
      dir: new URL('normalized/', knowledgeDataUrl),
      file: 'ingredients.json',
      body: normalizedIngredientsFile,
    },
    { dir: new URL('runtime/', knowledgeDataUrl), file: 'runtime.json', body: runtime },
    {
      dir: new URL('proposals/', knowledgeDataUrl),
      file: 'cooking-classes.json',
      body: cookingClasses,
    },
  ];
  for (const t of targets) {
    mkdirSync(fileURLToPath(t.dir), { recursive: true });
    writeFileSync(
      fileURLToPath(new URL(t.file, t.dir)),
      `${JSON.stringify(t.body, null, 2)}\n`,
      'utf8',
    );
  }

  writeln(
    `normalized: ${normalizedDishes.length} dishes, ${rawIngredients.length} ingredients ` +
      `(${NUTRIENT_KEYS.length} nutrients kept per ingredient)`,
  );
  const runtimeBytes = statSync(
    fileURLToPath(new URL('runtime.json', new URL('runtime/', knowledgeDataUrl))),
  ).size;
  writeln(`runtime.json size: ${runtimeBytes} bytes (target: under 150 KB)`);
  writeln('cooking classes for review (dishId | class | method):');
  for (const row of cookingClasses)
    writeln(`  ${row.dishId} | ${row.cookingClass} | ${row.method}`);
}

main();
