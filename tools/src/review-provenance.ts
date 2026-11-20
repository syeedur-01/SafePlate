import { NUTRIENT_KEYS, type Ingredient, type ReviewProvenance } from '@sp/contracts';

/**
 * Derives an ingredient's review provenance from its own state: `source_verified` only
 * when at least one nutrient value is present and every present value carries a
 * per-nutrient source entry; anything else stays `human_review_pending`. Pure.
 */
export function deriveIngredientReviewProvenance(ingredient: Ingredient): ReviewProvenance {
  let hasValue = false;
  for (const key of NUTRIENT_KEYS) {
    if (ingredient[key] === null) continue;
    hasValue = true;
    if (ingredient.nutrient_sources[key] === undefined) return 'human_review_pending';
  }
  return hasValue ? 'source_verified' : 'human_review_pending';
}

/**
 * Derives a dish's review provenance. All dishes were reviewed by the P2-DH01
 * AI-assisted stand-in panel whose output the owner accepted — no human nutritionist
 * took part — so the honest status for every dish is `ai_assisted_review`.
 */
export function deriveDishReviewProvenance(): ReviewProvenance {
  return 'ai_assisted_review';
}
