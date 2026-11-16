import {
  getDishes,
  getHealthRules,
  getIngredients,
  getMessages,
  getSafetyRules,
  getSources,
} from '@sp/knowledge';
import { verifyAll } from './verify-lib';

/** Loads the real data, prints the problems and a one-line summary, and exits 1 when inconsistent. */
const dishes = getDishes();
const ingredients = getIngredients();
const safetyRules = getSafetyRules();
const healthRules = getHealthRules();
const messages = getMessages();
const sourceIds = new Set(getSources().map((s) => s.id));

const problems = verifyAll({ dishes, ingredients, safetyRules, healthRules, messages, sourceIds });

for (const problem of problems) process.stdout.write(`PROBLEM ${problem}\n`);

const statusCount = new Map<string, number>();
for (const rule of [...safetyRules, ...healthRules]) {
  statusCount.set(rule.status, (statusCount.get(rule.status) ?? 0) + 1);
}
const statusText = [...statusCount.entries()].map(([status, n]) => `${n} ${status}`).join(', ');
process.stdout.write(
  `verify summary: ${dishes.length} dishes, ${ingredients.length} ingredients, rules: ${statusText}, ` +
    `${Object.keys(messages).length} messages, ${sourceIds.size} sources -> ${problems.length} problem(s)\n`,
);

if (problems.length > 0) process.exitCode = 1;

export {};
