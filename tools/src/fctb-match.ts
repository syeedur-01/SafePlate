import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getRawIngredients } from '@sp/knowledge';
import { calibrate, candidatesFor, type FctbRow } from './fctb-lib';
import type { NutrientKey } from '@sp/contracts';

/** One text item from the PDF with resolved coordinates. */
interface Item {
  text: string;
  x: number;
  endX: number;
  y: number;
}
/** One joined token of a visual row: text plus x-center. */
interface Token {
  text: string;
  centerX: number;
}
/** One food-code visual row: code plus its tokens in x order. */
interface CodeRow {
  page: number;
  code: string;
  tokens: Token[];
}
/** X-centers of the proximate table header columns of one page. */
interface ProximateAnchors {
  protein: number;
  fat: number;
  carbs: number;
  fibre: number;
  ash: number;
}

const FCTB_PDF_URL = new URL('../../data/raw/fctb-2013.pdf', import.meta.url);
const PROPOSALS_URL = new URL(
  '../../packages/knowledge/data/proposals/fctb-matches.json',
  import.meta.url,
);
const MATCH_LIMIT = 5;
const MATCH_MIN_SCORE = 0.3;
const CLUSTER_GAP = 12;
const CLUSTER_TOLERANCE = 14;
const ANCHOR_TOLERANCE = 16;
const CODE_LINE_LIMIT = 240; // numeric tokens left of this x belong to the food name
const BAND_HALF_HEIGHT = 8; // visual-row band around the code line, in y units
const HEADER_ZONE = 55; // y range below the page top holding the table header
const NULLABLE_NUTRIENT_KEYS = [
  'energy_kcal',
  'protein_g',
  'fat_g',
  'sat_fat_g',
  'carbs_g',
  'sugars_g',
  'fibre_g',
  'sodium_mg',
] as const satisfies readonly NutrientKey[];

/**
 * Returns true for numerically printed tokens: plain numbers or values in parentheses/brackets
 * (the table prints kcal in parentheses and occasionally marks fibre or mineral values in
 * square brackets; both are real values, not annotations).
 */
function numericLike(text: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(stripDelimiters(text));
}

/** Returns the token text without a leading or trailing parenthesis or square bracket. */
function stripDelimiters(text: string): string {
  let bare = text.trim();
  if (bare.startsWith('(') || bare.startsWith('[')) bare = bare.slice(1);
  if (bare.endsWith(')') || bare.endsWith(']')) bare = bare.slice(0, -1);
  return bare;
}

/**
 * Returns items of a page grouped into y-bucket lines, each sorted by x.
 */
function groupLines(items: Item[]): Item[][] {
  const buckets = new Map<number, Item[]>();
  for (const it of items) {
    const y = Math.round(it.y / 2) * 2;
    const list = buckets.get(y) ?? [];
    list.push(it);
    buckets.set(y, list);
  }
  return [...buckets.values()].map((list) => list.sort((a, b) => a.x - b.x));
}

/**
 * Merges adjacent items of a sorted line into single tokens when their x ranges touch, so
 * kerning-split fragments ("01_0"+"037", "0.1"+"4") stay one token.
 */
function joinTouching(line: Item[]): Item[] {
  const merged: Item[] = [];
  for (const it of line) {
    const prev = merged[merged.length - 1];
    if (prev && it.x < prev.endX + 1.5) {
      const x = Math.min(prev.x, it.x);
      const endX = Math.max(prev.endX, it.endX);
      merged[merged.length - 1] = { text: prev.text + it.text, x, endX, y: it.y };
    } else {
      merged.push({ ...it });
    }
  }
  return merged;
}

/**
 * Returns one row per food-code line: the band is the code item's y range (+-8), collecting the
 * neighbour lines of the same visual row. Each line is joined into tokens separately (so items of
 * different baselines never glue), then tokens are ordered by x (ties: upper line first). The
 * "SD or min- max" and "n" footnote lines between rows are never part of a row.
 */
function buildCodeRows(page: number, items: Item[]): CodeRow[] {
  const lines = groupLines(items);
  const out: CodeRow[] = [];
  for (const line of lines) {
    const codeIdx = line.findIndex((it) => /^\d{2}_\d{4}$/.test(it.text));
    const codeItem = codeIdx === -1 ? undefined : line[codeIdx];
    if (codeIdx === -1 || codeItem === undefined) continue;
    const bandLines: Item[][] = [];
    for (const other of lines) {
      const first = other[0];
      const otherY = first?.y;
      if (otherY === undefined || first === undefined) continue;
      if (Math.abs(otherY - codeItem.y) > BAND_HALF_HEIGHT) continue;
      const label = first.text.trim();
      if (label.startsWith('SD') || label === 'n') continue; // footnote line, not row values
      bandLines.push(other);
    }
    const joined = bandLines
      .flatMap((band) => joinTouching(band))
      .sort((a, b) => a.x - b.x || b.y - a.y);
    const tokens: Token[] = joined.map((it) => ({ text: it.text, centerX: (it.x + it.endX) / 2 }));
    let collected = '';
    let dataStart = 0;
    for (; dataStart < tokens.length; dataStart++) {
      const next = tokens[dataStart];
      if (next === undefined) break;
      const candidate = collected + next.text.trim();
      if (!/^\d*_?\d{0,4}$/.test(candidate)) break;
      collected = candidate;
      if (/^\d{2}_\d{4}$/.test(collected)) {
        dataStart += 1;
        break;
      }
    }
    if (!/^\d{2}_\d{4}$/.test(collected)) continue;
    out.push({ page, code: collected, tokens: tokens.slice(dataStart) });
  }
  return out;
}

/**
 * Returns the x-centers of the proximate header columns (Protein, Fat, Carbohydrate, dietary
 * fibre, Ash) of a page's top zone, or null when any of them is missing on that page.
 */
function proximateAnchors(items: Item[]): ProximateAnchors | null {
  if (items.length === 0) return null;
  const maxY = Math.max(...items.map((i) => i.y));
  const zone = items.filter((i) => i.y >= maxY - HEADER_ZONE);
  const centreOf = (pattern: RegExp): number | undefined => {
    const item = zone.find((i) => pattern.test(i.text.trim()));
    return item === undefined ? undefined : (item.x + item.endX) / 2;
  };
  const protein = centreOf(/^Protein/);
  const fat = centreOf(/^Fat/);
  const carbs = centreOf(/^Carbohydrate/);
  const fibre = centreOf(/^dietary/) ?? centreOf(/^fibre/);
  const ash = centreOf(/^Ash/);
  if (
    protein === undefined ||
    fat === undefined ||
    carbs === undefined ||
    fibre === undefined ||
    ash === undefined
  ) {
    return null;
  }
  return { protein, fat, carbs, fibre, ash };
}

/** Returns the numeric tokens of a row (value-area x positions only). */
function numberTokens(row: CodeRow): Token[] {
  return row.tokens.filter((t) => numericLike(t.text) && t.centerX > CODE_LINE_LIMIT);
}

/** Returns the name text of a row: every token before the first numeric token. */
function nameOf(row: CodeRow): string {
  const nums = new Set(numberTokens(row));
  const nameTokens: string[] = [];
  for (const token of row.tokens) {
    if (nums.has(token)) break;
    nameTokens.push(token.text);
  }
  return nameTokens.join(' ').replace(/\s+/g, ' ').trim();
}

/** Returns the row text for the human: all tokens in x order. */
function rowTextOf(row: CodeRow): string {
  return row.tokens
    .map((t) => t.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses proximate rows: energy is the leftmost parenthesized token; protein, fat, available
 * carbohydrates and total dietary fibre come from the token nearest to each header column.
 */
function parseProximateRow(page: number, row: CodeRow, anchors: ProximateAnchors): FctbRow {
  const nums = numberTokens(row);
  const values: Partial<Record<NutrientKey, number>> = {};
  const parenTokens = nums.filter((t) => /^[(]/.test(t.text));
  if (parenTokens.length > 0) {
    const kcalToken = parenTokens.reduce((a, b) => (a.centerX <= b.centerX ? a : b));
    values.energy_kcal = Number(stripDelimiters(kcalToken.text));
    const columns: ReadonlyArray<readonly [NutrientKey, number]> = [
      ['protein_g', anchors.protein],
      ['fat_g', anchors.fat],
      ['carbs_g', anchors.carbs],
      ['fibre_g', anchors.fibre],
    ];
    for (const [key, centre] of columns) {
      let best: Token | undefined;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const token of nums) {
        const distance = Math.abs(token.centerX - centre);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = token;
        }
      }
      if (best !== undefined && bestDistance <= ANCHOR_TOLERANCE)
        values[key] = Number(stripDelimiters(best.text));
    }
  }
  return {
    foodCode: row.code,
    name: nameOf(row),
    page,
    table: 'Proximate composition',
    values,
    rowText: rowTextOf(row),
  };
}

/**
 * Returns x-center clusters (ascending) of the numeric tokens of the given rows.
 */
function clustersOf(rows: CodeRow[]): number[] {
  const positions: number[] = [];
  for (const row of rows) {
    for (const token of numberTokens(row)) positions.push(token.centerX);
  }
  const sorted = [...positions].sort((a, b) => a - b);
  const clusters: number[] = [];
  let windowStart = 0;
  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];
    if (
      i === sorted.length ||
      (current !== undefined && previous !== undefined && current - previous > CLUSTER_GAP)
    ) {
      const slice = sorted.slice(windowStart, i);
      clusters.push(slice.reduce((a, b) => a + b, 0) / slice.length);
      windowStart = i;
    }
  }
  return clusters;
}

/**
 * Parses a mineral row: the eight columns run Ca, Fe, Mg, P, K, Na, Zn, Cu, so sodium is the token
 * nearest to the third cluster from the right (Cu, Zn, then Na).
 */
function parseMineralRow(page: number, row: CodeRow, clusters: number[]): FctbRow {
  const naCentre = clusters[clusters.length - 3] as number | undefined;
  let sodium: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  if (naCentre === undefined) {
    return {
      foodCode: row.code,
      name: nameOf(row),
      page,
      table: 'Mineral composition',
      values: {},
      rowText: rowTextOf(row),
    };
  }
  for (const token of numberTokens(row)) {
    const distance = Math.abs(token.centerX - naCentre);
    if (distance < bestDistance) {
      bestDistance = distance;
      sodium = Number(stripDelimiters(token.text));
    }
  }
  return {
    foodCode: row.code,
    name: nameOf(row),
    page,
    table: 'Mineral composition',
    values: bestDistance <= CLUSTER_TOLERANCE && sodium !== undefined ? { sodium_mg: sodium } : {},
    rowText: rowTextOf(row),
  };
}

/**
 * Parses one page: proximate rows (energy in parentheses) need the header anchors; mineral rows
 * (no parentheses) are only from pages whose mineral rows form exactly 8 clusters.
 */
function parsePage(
  page: number,
  rows: CodeRow[],
  items: Item[],
  counters: { proximate: number; mineral: number; skippedPages: number },
): FctbRow[] {
  const isProx = (row: CodeRow) => numberTokens(row).some((t) => t.text.startsWith('('));
  const proxRows = rows.filter(isProx);
  const minRows = rows.filter((r) => !isProx(r) && numberTokens(r).length >= 1);
  const out: FctbRow[] = [];
  const anchors = proxRows.length > 0 ? proximateAnchors(items) : null;
  if (proxRows.length > 0) {
    if (anchors !== null) {
      counters.proximate += proxRows.length;
      for (const row of proxRows) out.push(parseProximateRow(page, row, anchors));
    }
  }
  if (minRows.length > 0) {
    const mineralClusters = clustersOf(minRows);
    if (mineralClusters.length === 8) {
      counters.mineral += minRows.length;
      for (const row of minRows) out.push(parseMineralRow(page, row, mineralClusters));
    }
  }
  return out;
}

function writeln(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
  const pdfData = new Uint8Array(readFileSync(FCTB_PDF_URL));
  const doc = await pdfjs.getDocument({ data: pdfData, isEvalSupported: false }).promise;
  const rows: FctbRow[] = [];
  const counters = { proximate: 0, mineral: 0, skippedPages: 0 };
  for (let page = 1; page <= doc.numPages; page++) {
    const items: Item[] = [];
    const pageContent = await doc.getPage(page).then((p) => p.getTextContent());
    for (const rawItem of pageContent.items) {
      if (!('str' in rawItem)) continue; // marks carry no glyphs
      if (rawItem.str === '') continue;
      if (rawItem.str.trim() === '') continue; // spacing items would glue unrelated tokens
      const x = rawItem.transform[4];
      const width = rawItem.width ?? 0;
      items.push({ text: rawItem.str, x, endX: x + width, y: rawItem.transform[5] });
    }
    const codeRows = buildCodeRows(page, items);
    const before = rows.length;
    rows.push(...parsePage(page, codeRows, items, counters));
    if (codeRows.length > 0 && rows.length === before) counters.skippedPages += 1;
  }
  writeln(
    `parsed from PDF: ${counters.proximate} proximate rows, ${counters.mineral} sodium rows ` +
      `(${counters.skippedPages} code pages skipped: vitamin or unexpected layouts)`,
  );
  if (rows.length === 0) {
    process.stderr.write('no rows parsed from the PDF text; tables may be garbled\n');
    process.exitCode = 2;
    return;
  }
  const ingredients = getRawIngredients();
  const byKey = new Map(rows.map((r) => [`${r.table}|${r.foodCode}`, r]));
  const mismatchIds = calibrate(rows, ingredients);
  let pairs = 0;
  let verified = 0;
  const unverified: string[] = [];
  for (const ingredient of ingredients) {
    for (const [nutrient, source] of Object.entries(ingredient.nutrient_sources)) {
      const code = (source as { food_code?: unknown }).food_code;
      const table = (source as { table?: unknown }).table;
      if (typeof code !== 'string') continue;
      pairs += 1;
      const row = byKey.get(`${table}|${code}`);
      const parsed = row?.values[nutrient as NutrientKey];
      if (parsed !== undefined) {
        verified += 1;
      } else {
        unverified.push(
          `${ingredient.id} ${nutrient} (${row === undefined ? 'row not found' : 'PDF shows Tr'})`,
        );
      }
    }
  }
  writeln(
    `calibration: ${verified}/${pairs} source entries verified, ${mismatchIds.length} mismatches, ` +
      `${unverified.length} unverifiable (PDF shows Tr or row not extracted)`,
  );
  for (const id of mismatchIds) writeln(`  mismatch: ${id}`);
  for (const entry of unverified) writeln(`  unverifiable: ${entry}`);
  if (mismatchIds.length > 0) {
    process.stderr.write('calibration failed; column mapping is wrong; not writing proposals\n');
    process.exitCode = 2;
    return;
  }
  const proposals = [];
  let withCandidates = 0;
  for (const ingredient of ingredients) {
    const hasNull = NULLABLE_NUTRIENT_KEYS.some((key) => {
      const value = ingredient[key];
      return value === null || value === undefined;
    });
    if (!hasNull) continue;
    const matching = candidatesFor(ingredient.name_en, rows, MATCH_LIMIT, MATCH_MIN_SCORE);
    if (matching.length > 0) withCandidates += 1;
    proposals.push({
      ingredientId: ingredient.id,
      candidates: matching.map((c) => ({
        foodCode: c.foodCode,
        rowName: c.name,
        page: c.page,
        table: c.table,
        values: c.values,
        rowText: c.rowText,
        score: c.score,
      })),
      approvedFoodCode: null,
    });
  }
  const body = `${JSON.stringify(proposals, null, 2)}\n`;
  mkdirSync(fileURLToPath(new URL('./', PROPOSALS_URL)), { recursive: true });
  writeFileSync(PROPOSALS_URL, body, 'utf8');
  writeln(
    `proposals written: ${proposals.length} ingredients (raw rowText kept for every candidate, approvedFoodCode null), ` +
      `${withCandidates} with at least one candidate`,
  );
  writeln(
    `file: ${fileURLToPath(PROPOSALS_URL)} (${statSync(fileURLToPath(PROPOSALS_URL)).size} bytes)`,
  );
  writeln('page numbers in proposals are 1-based PDF viewer pages');
}

main();
