import type { Ingredient, NutrientKey, NutrientValues } from '@sp/contracts';

/** One approved FCTB table row for an ingredient (values per 100 g). */
export interface FctbApproval {
  ingredientId: string;
  foodCode: string;
  table: string;
  page: number;
  values: Partial<NutrientValues>;
}

/** One approved USDA record for an ingredient (patch contains only the values to fill). */
export interface UsdaApproval {
  ingredientId: string;
  fdcId: number;
  description: string;
  patch: Partial<NutrientValues>;
}

/** One approved row from the P1-DH02 gap file, tagged with its registered source id. */
export interface GapApprovalRow {
  source: string;
  foodCode: string | null;
  fdcId: number | null;
  rowName: string;
  table: string | null;
  page: number | null;
  values: Partial<NutrientValues>;
}

/** One approved gap-file entry: several source-tagged rows for one ingredient. */
export interface GapApproval {
  ingredientId: string;
  matchQuality: 'exact' | 'proxy' | null;
  rows: GapApprovalRow[];
}

/** Maps a registered source id from sources.json to the provenance source_id vocabulary. */
const SOURCE_IDS: Record<string, string> = {
  'bd-fctb-2013': 'FCTB-2013',
  'usda-fdc': 'USDA-FDC',
  'ifct-2017': 'IFCT-2017',
};

type NutrientSources = Ingredient['nutrient_sources'];

/**
 * Applies approvals to ingredients; only fills null fields; adds nutrient_sources, match_quality
 * and review_status. Pure; returns new objects. USDA approvals always flag the ingredient
 * `proxy` (TECH_DESIGN: USDA matches are proxy matches); FCTB approvals set no match_quality;
 * gap approvals use their entry's matchQuality, except USDA-sourced gap rows which stay `proxy`.
 */
export function applyApprovals(
  ingredients: Ingredient[],
  fctb: FctbApproval[],
  usda: UsdaApproval[],
  gap: GapApproval[] = [],
): { ingredients: Ingredient[]; applied: string[] } {
  const byId = new Map<string, Ingredient>(ingredients.map((i) => [i.id, { ...i }]));
  const applied: string[] = [];
  const markApplied = (id: string): void => {
    if (!applied.includes(id)) applied.push(id);
  };

  const fill = (
    ingredient: Ingredient,
    values: Partial<NutrientValues>,
    provenance: (nutrient: NutrientKey) => NutrientSources[string],
    matchQuality: 'direct' | 'proxy' | null,
  ): boolean => {
    let changed = false;
    for (const [key, value] of Object.entries(values) as Array<[NutrientKey, number | null]>) {
      if (value === null || value === undefined) continue;
      if (!(key in ingredient)) continue;
      if (ingredient[key] !== null) continue; // never overwrite a non-null value
      ingredient[key] = value;
      ingredient.nutrient_sources = { ...ingredient.nutrient_sources, [key]: provenance(key) };
      changed = true;
    }
    if (changed) {
      ingredient.review_status = 'approved';
      if (matchQuality !== null) ingredient.match_quality = matchQuality;
    }
    return changed;
  };

  for (const approval of fctb) {
    const ingredient = byId.get(approval.ingredientId);
    if (!ingredient) continue;
    const changed = fill(
      ingredient,
      approval.values,
      () => ({
        source_id: 'FCTB-2013',
        food_code: approval.foodCode,
        table: approval.table,
        pdf_page: approval.page,
      }),
      null,
    );
    if (changed) markApplied(approval.ingredientId);
  }

  for (const approval of usda) {
    const ingredient = byId.get(approval.ingredientId);
    if (!ingredient) continue;
    const changed = fill(
      ingredient,
      approval.patch,
      () => ({ source_id: 'USDA-FDC', fdc_id: approval.fdcId, description: approval.description }),
      'proxy',
    );
    if (changed) markApplied(approval.ingredientId);
  }

  for (const approval of gap) {
    const ingredient = byId.get(approval.ingredientId);
    if (!ingredient) continue;
    let changed = false;
    for (const row of approval.rows) {
      const sourceId = SOURCE_IDS[row.source];
      if (sourceId === undefined) {
        throw new Error(
          `gap approval for ${approval.ingredientId}: unknown row source "${row.source}"`,
        );
      }
      const rowChanged = fill(
        ingredient,
        row.values,
        () =>
          sourceId === 'USDA-FDC'
            ? { source_id: sourceId, fdc_id: row.fdcId, description: row.rowName }
            : {
                source_id: sourceId,
                food_code: row.foodCode,
                table: row.table,
                pdf_page: row.page,
                row_name: row.rowName,
              },
        row.source === 'usda-fdc' ? 'proxy' : gapMatchQuality(approval.matchQuality),
      );
      changed = changed || rowChanged;
    }
    if (changed) markApplied(approval.ingredientId);
  }

  return { ingredients: ingredients.map((i) => byId.get(i.id) ?? i), applied };
}

/** Maps a gap-file matchQuality to the ingredient match_quality vocabulary, or null to leave it unset. */
function gapMatchQuality(quality: GapApproval['matchQuality']): 'direct' | 'proxy' | null {
  if (quality === 'exact') return 'direct';
  if (quality === 'proxy') return 'proxy';
  return null;
}
