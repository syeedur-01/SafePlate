import type { Allergen } from '@sp/contracts';

export interface EvalItem {
  file: string;
  kind: 'dish' | 'label';
  split: 'dev' | 'holdout';
  expectedDishId?: string | null;
  expectedAllergens?: Allergen[];
  expectedExpiry?: string | null;
  notes?: string;
}
export interface DishPrediction {
  file: string;
  candidates: Array<{ dishId: string | null }>;
}
export interface LabelPrediction {
  file: string;
  declaredAllergens: Allergen[];
  expiryDate: string | null;
}

/** Returns num/den, or 0 when the denominator is 0 (never NaN). */
function ratio(num: number, den: number): number {
  if (den === 0) return 0;
  return num / den;
}

/**
 * Returns top1 and top3 accuracy over dish items that have an expectedDishId; unknownRate is the
 * share whose first candidate has dishId null. Dish items without an expectedDishId are not
 * evaluated. Items without a prediction count as a miss (not as unknown).
 */
export function dishMetrics(
  items: EvalItem[],
  preds: DishPrediction[],
): { n: number; top1: number; top3: number; unknownRate: number } {
  const byFile = new Map(preds.map((p) => [p.file, p]));
  const dishItems = items.filter(
    (i) => i.kind === 'dish' && typeof i.expectedDishId === 'string' && i.expectedDishId !== '',
  );
  let top1Hits = 0;
  let top3Hits = 0;
  let unknownCount = 0;
  for (const item of dishItems) {
    const pred = byFile.get(item.file);
    if (!pred) continue; // a missing prediction is a miss, not unknown
    const first = pred.candidates[0];
    if (first && first.dishId === null) {
      unknownCount += 1;
      continue;
    }
    if (first && first.dishId === item.expectedDishId) top1Hits += 1;
    const seen = pred.candidates
      .slice(0, 3)
      .some((c) => c.dishId !== null && c.dishId === item.expectedDishId);
    if (seen) top3Hits += 1;
  }
  const n = dishItems.length;
  return {
    n,
    top1: ratio(top1Hits, n),
    top3: ratio(top3Hits, n),
    unknownRate: ratio(unknownCount, n),
  };
}

/**
 * Returns micro precision and recall over allergens, plus the exact-match rate of expiry dates,
 * for label items. Items without a prediction count as a miss. A denominator of 0 gives 0.
 */
export function labelMetrics(
  items: EvalItem[],
  preds: LabelPrediction[],
): { n: number; allergenPrecision: number; allergenRecall: number; expiryExact: number } {
  const byFile = new Map(preds.map((p) => [p.file, p]));
  const labelItems = items.filter((i) => i.kind === 'label');
  let intersectTotal = 0;
  let predictedTotal = 0;
  let expectedTotal = 0;
  let expiryHits = 0;
  for (const item of labelItems) {
    const expected = new Set<Allergen>(item.expectedAllergens ?? []);
    const pred = byFile.get(item.file);
    const predicted = new Set<Allergen>(pred ? pred.declaredAllergens : []);
    for (const a of expected) if (predicted.has(a)) intersectTotal += 1;
    predictedTotal += predicted.size;
    expectedTotal += expected.size;
    const expectedExpiry = item.expectedExpiry ?? null;
    if (pred && pred.expiryDate === expectedExpiry) expiryHits += 1;
  }
  const n = labelItems.length;
  return {
    n,
    allergenPrecision: ratio(intersectTotal, predictedTotal),
    allergenRecall: ratio(intersectTotal, expectedTotal),
    expiryExact: ratio(expiryHits, n),
  };
}
