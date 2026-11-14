import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildRuntime, getRawDishes, getRawIngredients, normalizeDish } from '@sp/knowledge';
import { NormalizedDishesFileSchema, RawIngredientsFileSchema } from '@sp/contracts';

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
  const cookingClasses = rawDishes.map((d) => {
    const n = normalizedDishes.find((x) => x.id === d.id);
    return { dishId: d.id, method: d.cooking_method, cookingClass: n ? n.cooking_class : null };
  });

  const knowledgeDataUrl = new URL('../../packages/knowledge/data/', import.meta.url);
  // Normalized files are written first: buildRuntime() reads them from disk, so
  // the runtime export must never be built from stale normalized content.
  const normalizedTargets: Array<{ dir: URL; file: string; body: unknown }> = [
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
    {
      dir: new URL('proposals/', knowledgeDataUrl),
      file: 'cooking-classes.json',
      body: cookingClasses,
    },
  ];
  for (const t of normalizedTargets) {
    mkdirSync(fileURLToPath(t.dir), { recursive: true });
    writeFileSync(
      fileURLToPath(new URL(t.file, t.dir)),
      `${JSON.stringify(t.body, null, 2)}\n`,
      'utf8',
    );
  }

  const runtime = buildRuntime();
  const runtimeDir = new URL('runtime/', knowledgeDataUrl);
  mkdirSync(fileURLToPath(runtimeDir), { recursive: true });
  writeFileSync(
    fileURLToPath(new URL('runtime.json', runtimeDir)),
    `${JSON.stringify(runtime, null, 2)}\n`,
    'utf8',
  );

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
