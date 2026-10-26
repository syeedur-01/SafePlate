import type { Ingredient, NutrientKey } from '@sp/contracts';

/** One parsed FCTB table row. `page` is the PDF viewer page (1-based). */
export interface FctbRow {
  foodCode: string;
  name: string;
  page: number;
  table: 'Proximate composition' | 'Mineral composition';
  values: Partial<Record<NutrientKey, number>>;
  rowText: string;
}

const TOKEN_STOP_WORDS = new Set(['raw', 'fresh']);

/** Lowercases, removes punctuation and stop words ("raw", "fresh"), returns deduplicated tokens. */
export function tokens(name: string): string[] {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const seen = new Set<string>();
  for (const token of cleaned.split(/\s+/)) {
    if (token !== '' && !TOKEN_STOP_WORDS.has(token)) seen.add(token);
  }
  return [...seen];
}

/** Returns 0..1 token-overlap score between an ingredient query and a row name. */
export function scoreMatch(query: string, rowName: string): number {
  const a = new Set(tokens(query));
  const b = new Set(tokens(rowName));
  const denominator = Math.max(a.size, b.size);
  if (denominator === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / denominator;
}

/** Returns up to `limit` rows with score >= minScore, best first (ties keep input order). */
export function candidatesFor(
  query: string,
  rows: FctbRow[],
  limit: number = 5,
  minScore: number = 0.3,
): Array<FctbRow & { score: number }> {
  const scored: Array<FctbRow & { score: number }> = [];
  for (const r of rows) {
    const score = scoreMatch(query, r.name);
    if (score >= minScore) scored.push({ ...r, score });
  }
  scored.sort((x, y) => y.score - x.score || x.foodCode.localeCompare(y.foodCode));
  return scored.slice(0, limit);
}

/**
 * Compares parsed rows with ingredients that already carry a known food_code; returns mismatching
 * ingredient ids. A stored value is verified when a parsed row with the same table (or, when the
 * source entry stores no table, any parsed row with the same food_code) carries that nutrient and
 * the numbers differ. Cells the PDF shows as "Tr", and codes whose row was not found, cannot be
 * verified; they are not mismatches.
 */
export function calibrate(rows: FctbRow[], known: Ingredient[]): string[] {
  const bad = new Set<string>();
  for (const ingredient of known) {
    for (const [nutrient, source] of Object.entries(ingredient.nutrient_sources)) {
      const foodCode = (source as { food_code?: unknown }).food_code;
      const table = (source as { table?: unknown }).table;
      if (typeof foodCode !== 'string') continue;
      const stored = ingredient[nutrient as NutrientKey];
      if (stored === null || stored === undefined) continue;
      const candidates =
        typeof table === 'string'
          ? rows.filter((r) => r.table === table && r.foodCode === foodCode)
          : rows.filter((r) => r.foodCode === foodCode);
      if (candidates.length === 0) continue; // row not found: unverifiable
      const parsed = candidates.map((r) => r.values[nutrient as NutrientKey]);
      if (parsed.some((p) => p !== undefined && p !== stored)) {
        bad.add(ingredient.id);
      }
    }
  }
  return [...bad];
}
