import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeNutrition } from '@sp/engine';
import { getDishes, getIngredients, ingredientsById } from '@sp/knowledge';
import { demoDishIds } from './merge-lib';

const knowledgeDataUrl = new URL('../../packages/knowledge/data/', import.meta.url);
const MIN_COVERAGE = 0.8;
const MIN_DISHES_FOR_DEMO = 10;

function writeln(line: string): void {
  process.stdout.write(`${line}\n`);
}

function main(): void {
  const dishes = getDishes();
  const byId = ingredientsById(getIngredients());

  const coverageByDish = dishes.map((dish) => ({
    dishId: dish.id,
    energyCoverage: computeNutrition(dish, byId).perServing.energy_kcal.coverage,
  }));
  const dishIds = demoDishIds(coverageByDish, MIN_COVERAGE);

  writeFileSync(
    fileURLToPath(new URL('demo-dishes.json', new URL('runtime/', knowledgeDataUrl))),
    `${JSON.stringify({ minCoverage: MIN_COVERAGE, dishIds }, null, 2)}\n`,
    'utf8',
  );

  writeln(`demo gate: energy coverage >= ${MIN_COVERAGE}`);
  for (const id of dishIds) writeln(`  ${id}`);
  writeln(`dishes passing the gate: ${dishIds.length} of ${dishes.length}`);
  if (dishIds.length < MIN_DISHES_FOR_DEMO) {
    writeln(
      `WARNING for the team: only ${dishIds.length} dishes pass the gate — the demo needs at least ` +
        `${MIN_DISHES_FOR_DEMO}. Dishes below the gate still show safety, allergen and recognition results.`,
    );
  }
  writeln('done: packages/knowledge/data/runtime/demo-dishes.json');
}

main();
