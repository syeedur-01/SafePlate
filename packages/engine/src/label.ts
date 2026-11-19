import type {
  Allergen,
  HealthRule,
  NutrientKey,
  NutritionResult,
  NutrientValues,
  UserProfile,
  Warning,
} from '@sp/contracts';
import { NUTRIENT_KEYS } from '@sp/contracts';
import { evaluateSuitability } from './suitability';

export type AllergenKeywords = Record<Allergen, string[]>; // lowercase words or phrases; matched as whole tokens (Bangla and Latin), never inside a longer word

/**
 * Optional context rules for allergen matching, loaded from allergen-matching.json.
 * `uncertain` keywords mark a possible match (shown as uncertainty, never a confirmed hit);
 * `suppress` phrases cancel an uncertain match next to them ("rice flour" is not wheat);
 * `advisoryPhrases` open a "may contain" zone; `negationBefore`/`negationAfter` phrases
 * cancel a match they precede or follow ("does not contain milk", "দুধ ছাড়া").
 */
export interface AllergenMatching {
  uncertain?: Partial<Record<Allergen, string[]>>;
  suppress?: Partial<Record<Allergen, string[]>>;
  advisoryPhrases?: string[];
  negationBefore?: string[];
  negationAfter?: string[];
}

/** Notice key emitted when the label text could not be read: no detection is not allergen-free. */
export const LABEL_UNREADABLE_NOTICE_KEY = 'notice.label_unreadable';

export interface DetectedAllergen {
  allergen: Allergen;
  via: 'declared' | 'ingredients' | 'advisory';
  uncertain: boolean;
}

/** Splits text into lowercase letter/number tokens (Unicode-aware, and combining marks stay attached so Bangla words keep their vowel signs). */
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

/** Returns the [start, end) token index ranges where the keyword's tokens appear consecutively. */
function occurrencesOf(keyword: string, tokens: string[]): Array<[number, number]> {
  const kt = tokenize(keyword);
  if (kt.length === 0) return [];
  const ranges: Array<[number, number]> = [];
  outer: for (let i = 0; i + kt.length <= tokens.length; i++) {
    for (let j = 0; j < kt.length; j++) {
      if (tokens[i + j] !== kt[j]) continue outer;
    }
    ranges.push([i, i + kt.length]);
  }
  return ranges;
}

/** Splits text into segments on sentence-like punctuation so an advisory zone cannot run past it. */
function segmentText(text: string): string[] {
  return text.split(/[.;!।]/);
}

const ADVISORY_ZONE_BEFORE_TOKENS = 2;

interface SegmentPlan {
  tokens: string[];
  advisoryFrom: Set<number>; // token indices inside a "may contain" zone
}

/** Returns, per segment, the tokens plus the indices covered by an advisory zone. A comma bounds the zone on both sides, so "wheat flour, may contain milk" confirms wheat but advises milk. */
function segmentPlans(text: string, advisoryPhrases: string[]): SegmentPlan[] {
  const plans: SegmentPlan[] = [];
  for (const segment of segmentText(text)) {
    const infos = [...segment.matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map((m) => ({
      text: m[0].toLowerCase(),
      start: m.index,
      end: m.index + m[0].length,
    }));
    const tokens = infos.map((info) => info.text);
    const hasCommaBefore = (i: number): boolean =>
      i > 0 && /,/.test(segment.slice(infos[i - 1]!.end, infos[i]!.start));
    const advisoryFrom = new Set<number>();
    for (const phrase of advisoryPhrases) {
      for (const [start, end] of occurrencesOf(phrase, tokens)) {
        for (let i = end; i < tokens.length && (i === end || !hasCommaBefore(i)); i++) {
          advisoryFrom.add(i);
        }
        for (
          let i = start - 1;
          i >= Math.max(0, start - ADVISORY_ZONE_BEFORE_TOKENS) && !hasCommaBefore(i + 1);
          i--
        ) {
          advisoryFrom.add(i);
        }
      }
    }
    plans.push({ tokens, advisoryFrom });
  }
  return plans;
}

/** Returns true when any negation phrase ends within `beforeWindow` tokens before, or starts within 1 token after, the match range. */
function isNegated(
  range: [number, number],
  tokens: string[],
  negationBefore: string[],
  negationAfter: string[],
): boolean {
  for (const phrase of negationBefore) {
    for (const [, end] of occurrencesOf(phrase, tokens)) {
      if (end >= range[0] - 3 && end <= range[0]) return true;
    }
  }
  for (const phrase of negationAfter) {
    for (const [start] of occurrencesOf(phrase, tokens)) {
      if (start >= range[0] && start <= range[1]) return true;
    }
  }
  return false;
}

/** Returns true when a suppress phrase overlaps the uncertain match (one token of slack before it). */
function isSuppressed(
  range: [number, number],
  tokens: string[],
  suppressPhrases: string[],
): boolean {
  for (const phrase of suppressPhrases) {
    for (const [start, end] of occurrencesOf(phrase, tokens)) {
      if (start <= range[0] + 1 && end >= range[0]) return true;
    }
  }
  return false;
}

interface MatchResult {
  allergen: Allergen;
  via: 'ingredients' | 'advisory';
  uncertain: boolean;
}

/** Returns the first text-based match for an allergen: confirmed ingredient match beats uncertain beats advisory. */
function matchAllergen(
  allergen: Allergen,
  keywords: string[],
  matching: AllergenMatching,
  plans: SegmentPlan[],
): MatchResult | null {
  const uncertainWords = matching.uncertain?.[allergen] ?? [];
  const suppressPhrases = matching.suppress?.[allergen] ?? [];
  const negationBefore = matching.negationBefore ?? [];
  const negationAfter = matching.negationAfter ?? [];

  let advisory = false;
  let uncertain = false;

  for (const plan of plans) {
    for (const word of keywords) {
      for (const range of occurrencesOf(word, plan.tokens)) {
        if (isNegated(range, plan.tokens, negationBefore, negationAfter)) continue;
        if (plan.advisoryFrom.has(range[0])) advisory = true;
        else return { allergen, via: 'ingredients', uncertain: false };
      }
    }
    for (const word of uncertainWords) {
      for (const range of occurrencesOf(word, plan.tokens)) {
        if (isNegated(range, plan.tokens, negationBefore, negationAfter)) continue;
        if (plan.advisoryFrom.has(range[0])) advisory = true;
        else if (!isSuppressed(range, plan.tokens, suppressPhrases)) uncertain = true;
      }
    }
  }
  if (uncertain) return { allergen, via: 'ingredients', uncertain: true };
  if (advisory) return { allergen, via: 'advisory', uncertain: true };
  return null;
}

/** Returns declared allergens plus any allergen whose keyword appears as whole tokens in the ingredients text (case-insensitive). Declared wins when both apply. */
export function detectAllergens(
  label: Pick<LabelInput, 'ingredientsText' | 'declaredAllergens'>,
  keywords: AllergenKeywords,
  matching: AllergenMatching = {},
): DetectedAllergen[] {
  const detected: DetectedAllergen[] = [];
  const seen = new Set<Allergen>();

  for (const allergen of label.declaredAllergens) {
    if (seen.has(allergen)) continue;
    seen.add(allergen);
    detected.push({ allergen, via: 'declared', uncertain: false });
  }

  const text = label.ingredientsText?.toLowerCase() ?? '';
  if (text.length === 0) return detected;
  const plans = segmentPlans(text, matching.advisoryPhrases ?? []);
  for (const allergen of Object.keys(keywords) as Allergen[]) {
    if (seen.has(allergen)) continue;
    const hit = matchAllergen(allergen, keywords[allergen], matching, plans);
    if (hit === null) continue;
    seen.add(allergen);
    detected.push({ allergen: hit.allergen, via: hit.via, uncertain: hit.uncertain });
  }
  return detected;
}

export interface LabelInput {
  ingredientsText: string | null;
  declaredAllergens: Allergen[];
  nutritionPer100g: Partial<NutrientValues> | null;
}

/** Returns warnings: allergen conflicts first (confirmed = avoid, uncertain/advisory = caution with a distinct message), then nutrient-rule warnings evaluated per 100 g (params basis 'per_100g'). */
export function analyzeLabel(args: {
  label: LabelInput;
  profile: UserProfile;
  rules: HealthRule[];
  keywords: AllergenKeywords;
  matching?: AllergenMatching;
}): { warnings: Warning[]; detected: DetectedAllergen[] } {
  const { label, profile, rules, keywords, matching = {} } = args;
  const detected = detectAllergens(label, keywords, matching);

  const allergenConflicts: Warning[] = detected
    .filter((d) => profile.allergies.includes(d.allergen))
    .map((d) => ({
      id: `allergen:${d.allergen}`,
      kind: 'allergen',
      level: d.uncertain ? 'caution' : 'avoid',
      condition: null,
      allergen: d.allergen,
      messageKey: d.uncertain ? 'warn.allergen_may_contain' : 'warn.allergen_present',
      params: { allergen: d.allergen, via: d.via },
      sourceRef: null,
    }));

  const nutrientWarnings = evaluateSuitability({
    profile,
    dishAllergens: [],
    cookingClass: null,
    safetyTags: [],
    nutrition: labelNutrition(label.nutritionPer100g),
    rules,
  }).map((warning) => ({ ...warning, params: { ...warning.params, basis: 'per_100g' as const } }));

  return { warnings: [...allergenConflicts, ...nutrientWarnings], detected };
}

/** Returns a NutritionResult from the label's per-100 g values; absent nutrients are `shown: false`, never zero. */
function labelNutrition(values: Partial<NutrientValues> | null): NutritionResult {
  const entry = (nutrient: NutrientKey): NutritionResult['perServing'][NutrientKey] => {
    const value = values?.[nutrient];
    if (value === null || value === undefined) {
      return { value: null, coverage: 0, shown: false, origin: 'none' };
    }
    return { value, coverage: 1, shown: true, origin: 'calculated' };
  };

  const perServing = {
    energy_kcal: entry('energy_kcal'),
    protein_g: entry('protein_g'),
    fat_g: entry('fat_g'),
    sat_fat_g: entry('sat_fat_g'),
    carbs_g: entry('carbs_g'),
    sugars_g: entry('sugars_g'),
    fibre_g: entry('fibre_g'),
    sodium_mg: entry('sodium_mg'),
  };
  const present = NUTRIENT_KEYS.filter((nutrient) => perServing[nutrient].shown).length;

  return {
    perServing,
    overallCoverage: present / NUTRIENT_KEYS.length,
    missingIngredientIds: [],
    estimated: true,
  };
}
