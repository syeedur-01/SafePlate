import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  NUTRIENT_KEYS,
  RawIngredientsFileSchema,
  type Ingredient,
  type NutrientKey,
  type NutrientValues,
} from '@sp/contracts';
import {
  applyApprovals,
  type FctbApproval,
  type GapApproval,
  type GapApprovalRow,
  type UsdaApproval,
} from './apply-lib';

const knowledgeDataUrl = new URL('../../packages/knowledge/data/', import.meta.url);

function writeln(line: string): void {
  process.stdout.write(`${line}\n`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(relativePath: string, what: string): unknown {
  let text: string;
  try {
    text = readFileSync(fileURLToPath(new URL(relativePath, knowledgeDataUrl)), 'utf8');
  } catch {
    throw new Error(`missing proposal/data file: ${relativePath} (${what})`);
  }
  return JSON.parse(text);
}

function requireRecord(value: unknown, what: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${what} must be an object`);
  return value;
}

function requireArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${what} must be an array`);
  return value;
}

function requireString(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new Error(`${what} must be a string`);
  return value;
}

function requireNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`${what} must be a number`);
  return value;
}

/** Validates a per-100 g nutrient values object; unknown keys or non-numbers throw. */
function requireNutrientValues(value: unknown, what: string): Partial<NutrientValues> {
  if (!isRecord(value)) throw new Error(`${what} must be an object`);
  const values: Partial<NutrientValues> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!(NUTRIENT_KEYS as readonly string[]).includes(key)) {
      throw new Error(`${what}: unknown nutrient key "${key}"`);
    }
    values[key as NutrientKey] = requireNumber(raw, `${what}.${key}`);
  }
  return values;
}

/** Builds FCTB approvals from an fctb-matches entry: approvedRows first, then matching candidate rows. */
function fctbApprovalsFromEntry(entry: Record<string, unknown>): FctbApproval[] {
  const ingredientId = requireString(entry.ingredientId, 'fctb entry ingredientId');
  const approvals: FctbApproval[] = [];
  const seen = new Set<string>();
  const addRow = (
    foodCode: string,
    table: string,
    page: number,
    values: Partial<NutrientValues>,
  ): void => {
    const key = `${foodCode}|${table}|${page}`;
    if (seen.has(key)) return;
    seen.add(key);
    approvals.push({ ingredientId, foodCode, table, page, values });
  };
  const approvedFoodCode = entry.approvedFoodCode ?? null;
  for (const raw of requireArray(entry.approvedRows ?? [], `fctb ${ingredientId} approvedRows`)) {
    const row = requireRecord(raw, `fctb ${ingredientId} approvedRows entry`);
    addRow(
      requireString(row.foodCode, `fctb ${ingredientId} approvedRows foodCode`),
      requireString(row.table, `fctb ${ingredientId} approvedRows table`),
      requireNumber(row.page, `fctb ${ingredientId} approvedRows page`),
      requireNutrientValues(row.values, `fctb ${ingredientId} approvedRows values`),
    );
  }
  if (approvedFoodCode !== null) {
    const code = requireString(approvedFoodCode, `fctb ${ingredientId} approvedFoodCode`);
    for (const raw of requireArray(entry.candidates ?? [], `fctb ${ingredientId} candidates`)) {
      const candidate = requireRecord(raw, `fctb ${ingredientId} candidate`);
      if (candidate.foodCode !== code) continue;
      addRow(
        code,
        requireString(candidate.table, `fctb ${ingredientId} candidate table`),
        requireNumber(candidate.page, `fctb ${ingredientId} candidate page`),
        requireNutrientValues(candidate.values, `fctb ${ingredientId} candidate values`),
      );
    }
  }
  return approvals;
}

/** Builds the USDA approval from a usda-matches entry (approvedFdcId must exist in candidates). */
function usdaApprovalFromEntry(entry: Record<string, unknown>): UsdaApproval | null {
  const approvedFdcId = entry.approvedFdcId ?? null;
  if (approvedFdcId === null) return null;
  const ingredientId = requireString(entry.ingredientId, 'usda entry ingredientId');
  const fdcId = requireNumber(approvedFdcId, `usda ${ingredientId} approvedFdcId`);
  for (const raw of requireArray(entry.candidates ?? [], `usda ${ingredientId} candidates`)) {
    const candidate = requireRecord(raw, `usda ${ingredientId} candidate`);
    if (candidate.fdcId !== fdcId) continue;
    return {
      ingredientId,
      fdcId,
      description: requireString(
        candidate.description,
        `usda ${ingredientId} candidate description`,
      ),
      patch: requireNutrientValues(candidate.patch ?? {}, `usda ${ingredientId} candidate patch`),
    };
  }
  throw new Error(
    `usda ${ingredientId}: approvedFdcId ${fdcId} has no candidate row; the proposal file is inconsistent`,
  );
}

/** Builds the gap approval from a gap-matches entry (only decision "approved"). */
function gapApprovalFromEntry(entry: Record<string, unknown>): GapApproval | null {
  if (entry.decision !== 'approved') return null;
  const ingredientId = requireString(entry.ingredientId, 'gap entry ingredientId');
  const rows: GapApprovalRow[] = [];
  for (const raw of requireArray(entry.approvedRows ?? [], `gap ${ingredientId} approvedRows`)) {
    const row = requireRecord(raw, `gap ${ingredientId} row`);
    rows.push({
      source: requireString(row.source, `gap ${ingredientId} row source`),
      foodCode:
        row.foodCode == null
          ? null
          : requireString(row.foodCode, `gap ${ingredientId} row foodCode`),
      fdcId: row.fdcId == null ? null : requireNumber(row.fdcId, `gap ${ingredientId} row fdcId`),
      rowName: requireString(row.rowName, `gap ${ingredientId} row rowName`),
      table: row.table == null ? null : requireString(row.table, `gap ${ingredientId} row table`),
      page: row.page == null ? null : requireNumber(row.page, `gap ${ingredientId} row page`),
      values: requireNutrientValues(row.values, `gap ${ingredientId} row values`),
    });
  }
  const matchQuality = entry.matchQuality ?? null;
  if (matchQuality !== null && matchQuality !== 'exact' && matchQuality !== 'proxy') {
    throw new Error(`gap ${ingredientId}: matchQuality must be "exact", "proxy" or null`);
  }
  return {
    ingredientId,
    matchQuality: matchQuality as GapApproval['matchQuality'],
    rows,
  };
}

function main(): void {
  const ingredientsFile = RawIngredientsFileSchema.parse(
    readJson('normalized/ingredients.json', 'normalized ingredients'),
  );
  const fctbFile = requireArray(
    readJson('proposals/fctb-matches.json', 'fctb proposals'),
    'fctb-matches.json',
  );
  const usdaFile = requireArray(
    readJson('proposals/usda-matches.json', 'usda proposals'),
    'usda-matches.json',
  );
  const gapFile = requireArray(
    readJson('proposals/gap-matches-proposals.json', 'gap proposals'),
    'gap-matches-proposals.json',
  );

  const fctb: FctbApproval[] = [];
  for (const raw of fctbFile) {
    fctb.push(...fctbApprovalsFromEntry(requireRecord(raw, 'fctb-matches entry')));
  }
  const usda: UsdaApproval[] = [];
  for (const raw of usdaFile) {
    const approval = usdaApprovalFromEntry(requireRecord(raw, 'usda-matches entry'));
    if (approval !== null) usda.push(approval);
  }
  const gap: GapApproval[] = [];
  for (const raw of gapFile) {
    const approval = gapApprovalFromEntry(requireRecord(raw, 'gap-matches entry'));
    if (approval !== null) gap.push(approval);
  }

  const result = applyApprovals(ingredientsFile.ingredients, fctb, usda, gap);
  writeln(
    `approvals loaded: ${fctb.length} FCTB rows, ${usda.length} USDA records, ` +
      `${gap.length} gap entries; ingredients changed: ${result.applied.length}`,
  );
  for (const id of result.applied) writeln(`  applied: ${id}`);

  const updatedFile = RawIngredientsFileSchema.parse({
    metadata: {
      source: 'data/source/ingredients.json (never edited)',
      generator: 'pnpm --filter @sp/tools apply-approved (tools/src/apply-approved.ts)',
    },
    ingredients: result.ingredients,
  });
  writeFileSync(
    fileURLToPath(new URL('normalized/ingredients.json', knowledgeDataUrl)),
    `${JSON.stringify(updatedFile, null, 2)}\n`,
    'utf8',
  );

  patchRuntime(result.ingredients, result.applied);

  const stillNull = result.ingredients.filter((i: Ingredient) => i.energy_kcal === null).length;
  writeln(
    `done: normalized/ingredients.json and runtime/runtime.json updated; ${stillNull} ingredients still have no energy value`,
  );
}

/** Patches the slim runtime.json ingredient records (values and match_quality) in place. */
function patchRuntime(ingredients: Ingredient[], applied: string[]): void {
  const runtime = requireRecord(readJson('runtime/runtime.json', 'runtime'), 'runtime.json');
  const runtimeIngredients = requireArray(runtime.ingredients, 'runtime.json ingredients');
  const changed = new Map(ingredients.filter((i) => applied.includes(i.id)).map((i) => [i.id, i]));
  const patched = runtimeIngredients.map((raw) => {
    const record = requireRecord(raw, 'runtime ingredient');
    const id = requireString(record.id, 'runtime ingredient id');
    const ingredient = changed.get(id);
    if (ingredient === undefined) return record;
    const next: Record<string, unknown> = { ...record };
    for (const key of NUTRIENT_KEYS) next[key] = ingredient[key];
    if (ingredient.match_quality !== undefined) next.match_quality = ingredient.match_quality;
    else delete next.match_quality;
    return next;
  });
  writeFileSync(
    fileURLToPath(new URL('runtime/runtime.json', knowledgeDataUrl)),
    `${JSON.stringify({ ...runtime, ingredients: patched }, null, 2)}\n`,
    'utf8',
  );
}

main();
