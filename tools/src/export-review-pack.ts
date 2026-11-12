import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  HealthRulesFileSchema,
  SafetyRulesFileSchema,
  type Dish,
  type HealthRule,
  type SafetyRule,
} from '@sp/contracts';
import { getDishes, getIngredients } from '@sp/knowledge';
import { toCsv, type CsvValue } from './csv';

const knowledgeDataUrl = new URL('../../packages/knowledge/data/', import.meta.url);

function writeln(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Returns the dishes-review rows: one row per ingredient line, dish fields repeated. */
function dishRows(dishes: Dish[], namesById: Map<string, string>): Array<Record<string, CsvValue>> {
  const rows: Array<Record<string, CsvValue>> = [];
  for (const dish of dishes) {
    for (const line of dish.ingredients) {
      rows.push({
        dish_id: dish.id,
        dish_name_en: dish.name_en,
        dish_name_bn: dish.name_bn,
        serving_description: dish.serving_description,
        serving_weight_g: dish.serving_weight_g,
        ingredient_id: line.ingredient_id,
        ingredient_name_en: namesById.get(line.ingredient_id) ?? null,
        grams_raw: line.grams_raw,
        quantity_basis: line.quantity_basis,
        cooking_class: dish.cooking_class,
        allergens: dish.allergens.join(', '),
        safety_tags: dish.safety_tags.join(', '),
        nutrition_basis: dish.nutrition_basis,
        expert_decision: null,
      });
    }
  }
  return rows;
}

/** Returns a short human-readable trigger or condition text for a rule. */
function conditionOrTrigger(rule: SafetyRule | HealthRule): string {
  if ('trigger' in rule) {
    const trigger = rule.trigger;
    if (trigger.type === 'spoilage_sign') return `spoilage sign: ${trigger.sign}`;
    if (trigger.type === 'dish_tag') return `dish tag: ${trigger.tag}`;
    return 'label expired';
  }
  if (rule.kind === 'nutrient') return rule.condition;
  const match =
    'cookingClasses' in rule.match
      ? `cooking classes: ${rule.match.cookingClasses.join(', ')}`
      : `safety tags: ${rule.match.safetyTags.join(', ')}`;
  return `${rule.condition} (${match})`;
}

/** Returns the rules-review rows: one row per proposal rule, safety and health alike. */
function ruleRows(safety: SafetyRule[], health: HealthRule[]): Array<Record<string, CsvValue>> {
  const rows: Array<Record<string, CsvValue>> = [];
  for (const rule of safety) {
    rows.push({
      rule_id: rule.id,
      type: 'safety',
      condition_or_trigger: conditionOrTrigger(rule),
      points: rule.points,
      daily_limit: null,
      caution_fraction: null,
      avoid_fraction: null,
      level: null,
      source: rule.sourceRef,
      basis: rule.basis ?? null,
      status: rule.status,
      expert_decision: null,
    });
  }
  for (const rule of health) {
    rows.push({
      rule_id: rule.id,
      type: rule.kind,
      condition_or_trigger: conditionOrTrigger(rule),
      points: null,
      daily_limit: rule.kind === 'nutrient' ? rule.dailyLimit : null,
      caution_fraction: rule.kind === 'nutrient' ? rule.cautionFraction : null,
      avoid_fraction: rule.kind === 'nutrient' ? rule.avoidFraction : null,
      level: rule.kind === 'tag' ? rule.level : null,
      source: rule.sourceRef,
      basis: rule.basis ?? null,
      status: rule.status,
      expert_decision: null,
    });
  }
  return rows;
}

/** Returns parsed JSON from a path relative to packages/knowledge/data/, failing loudly when absent. */
function readProposal(relativePath: string, what: string): unknown {
  let text: string;
  try {
    text = readFileSync(fileURLToPath(new URL(relativePath, knowledgeDataUrl)), 'utf8');
  } catch {
    throw new Error(`missing proposal file: ${relativePath} (${what})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`cannot parse ${what}: ${relativePath}`);
  }
}

function main(): void {
  const dishes = getDishes();
  const namesById = new Map(getIngredients().map((i) => [i.id, i.name_en]));

  const safety = SafetyRulesFileSchema.parse(
    readProposal('proposals/safety-rules-proposals.json', 'safety rule proposals'),
  ).rules;
  const health = HealthRulesFileSchema.parse(
    readProposal('proposals/health-rules-proposals.json', 'health rule proposals'),
  ).rules;

  const dishRowsCount = dishes.reduce((sum, d) => sum + d.ingredients.length, 0);
  const reviewUrl = new URL('review/', knowledgeDataUrl);
  mkdirSync(fileURLToPath(reviewUrl), { recursive: true });

  writeFileSync(
    fileURLToPath(new URL('dishes-review.csv', reviewUrl)),
    toCsv(dishRows(dishes, namesById), [
      'dish_id',
      'dish_name_en',
      'dish_name_bn',
      'serving_description',
      'serving_weight_g',
      'ingredient_id',
      'ingredient_name_en',
      'grams_raw',
      'quantity_basis',
      'cooking_class',
      'allergens',
      'safety_tags',
      'nutrition_basis',
      'expert_decision',
    ]),
    'utf8',
  );

  writeFileSync(
    fileURLToPath(new URL('rules-review.csv', reviewUrl)),
    toCsv(ruleRows(safety, health), [
      'rule_id',
      'type',
      'condition_or_trigger',
      'points',
      'daily_limit',
      'caution_fraction',
      'avoid_fraction',
      'level',
      'source',
      'basis',
      'status',
      'expert_decision',
    ]),
    'utf8',
  );

  writeln(`dishes-review.csv: ${dishRowsCount} ingredient rows for ${dishes.length} dishes`);
  writeln(
    `rules-review.csv: ${safety.length + health.length} rules (${safety.length} safety, ${health.length} health)`,
  );
  writeln('done: packages/knowledge/data/review/dishes-review.csv, rules-review.csv');
}

main();
