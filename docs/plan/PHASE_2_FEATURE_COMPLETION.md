# PHASE 2: Feature completion (Mon Oct 26 to Tue Oct 27)

**Goal:** every feature exists and works against mocks and the real data: swaps, shopping list, label analysis, the full `analyze()` call, the scan API with cache and guards, all result screens, and verified rules and messages.

**Exit criteria:** all P2 cards merged; `pnpm check` green; coverage gate decided (P2-D06); tag `phase-2-done`. Anything unfinished is cut by the order in `00_INDEX_AND_WORKFLOW.md`.

**Rule for this phase:** the web cards (C) are **presentational**. They take `AnalysisResult` and friends as props and are built against fixtures. The engine is wired into the app in **P3-X02**. This keeps track C from waiting on track A.

| Track | Order                                                                          |
| ----- | ------------------------------------------------------------------------------ |
| A     | A01 and A02 and A03 in parallel (A01 needs P1-A04) → A04 (needs A01, A02, A03) |
| B     | B01 → B02 and B03 in parallel → B04                                            |
| C     | C01 and C02 and C03 and C04 in parallel (fixtures) → C05 → C06                 |
| D     | D01 → D02 and D03 and D04 and D05 and D07 in parallel → DH01 (human) → D06     |

---

# TRACK A: Engine

## P2-A01 Swap suggestions

**Depends on:** P1-A04 · **Blocks:** A04 · **Branch:** `a/P2-A01-swaps`

**Goal:** suggest other dishes that are better for the nutrients that triggered a warning for this user.

**Files:** create `packages/engine/src/swaps.ts`, `packages/engine/test/swaps.test.ts`; edit `index.ts`.

**Spec:**

```ts
import type { Dish, Ingredient, HealthRule, UserProfile, Swap } from '@sp/contracts';
export const MIN_IMPROVEMENT = 0.2; // the swap must be at least 20 percent lower
export function suggestSwaps(args: {
  dish: Dish;
  profile: UserProfile;
  dishes: Dish[];
  ingredients: Map<string, Ingredient>;
  rules: HealthRule[];
  limit?: number; // default 3
}): Swap[];
```

1. Compute the current dish's nutrition. **Flagged nutrients** = nutrients of nutrient rules whose condition the user has, where the nutrient is `shown` and `value / dailyLimit >= cautionFraction`. None flagged returns `[]`.
2. Candidate = another dish with **no allergen conflict**, whose nutrition for **every flagged nutrient is `shown`** and at least `MIN_IMPROVEMENT` lower than the current dish, and which does not itself produce an `avoid` warning for the user (use `evaluateSuitability`).
3. `improves` = the flagged nutrients that improved. Sort by number improved (descending), then by the largest relative improvement, then by `dishId`. `reasonKey: 'swap.lower_nutrient'`. Respect `limit`.

**Tests (write first)** (fixture numbers only):

```ts
import { describe, it, expect } from 'vitest';
import type { HealthRule } from '@sp/contracts';
import { makeDish, makeIngredient, makeProfile } from '@sp/contracts/testing';
import { suggestSwaps } from '../src/swaps';

const ing = new Map(
  [
    makeIngredient({ id: 'salty', sodium_mg: 1000 }),
    makeIngredient({ id: 'plain', sodium_mg: 100 }),
  ].map((i) => [i.id, i]),
);
const dish = (id: string, ingredient: string, grams: number, extra: object = {}) =>
  makeDish({
    id,
    ingredients: [{ ingredient_id: ingredient, grams_raw: grams, quantity_basis: 'ESTIMATE' }],
    ...extra,
  }) as ReturnType<typeof makeDish> & { cooking_class: 'mixed_or_other' };
const rule: HealthRule = {
  kind: 'nutrient',
  id: 'htn',
  condition: 'hypertension',
  nutrient: 'sodium_mg',
  dailyLimit: 2000,
  cautionFraction: 0.3,
  avoidFraction: 0.6,
  messageKey: 'warn.sodium_high',
  sourceRef: 'S',
  status: 'draft',
};
const A = dish('a', 'salty', 100); // 1000 mg, 50 percent: caution
const B = dish('b', 'plain', 100); // 100 mg
const C = dish('c', 'salty', 50); // 500 mg, 50 percent lower
const D = dish('d', 'plain', 100, { allergens: ['milk'] });
const profile = makeProfile({ conditions: ['hypertension'] });
const base = { dish: A, dishes: [A, B, C, D], ingredients: ing, rules: [rule] };

describe('suggestSwaps', () => {
  it('returns the best improvements first', () => {
    expect(suggestSwaps({ ...base, profile }).map((s) => s.dishId)).toEqual(['b', 'c']);
  });
  it('lists the improved nutrients and a reason key', () => {
    expect(suggestSwaps({ ...base, profile })[0]).toMatchObject({
      dishId: 'b',
      improves: ['sodium_mg'],
      reasonKey: 'swap.lower_nutrient',
    });
  });
  it('respects the limit', () => {
    expect(suggestSwaps({ ...base, profile, limit: 1 })).toHaveLength(1);
  });
  it('skips dishes with an allergen the user has', () => {
    expect(
      suggestSwaps({
        ...base,
        profile: makeProfile({ conditions: ['hypertension'], allergies: ['milk'] }),
      }).map((s) => s.dishId),
    ).toEqual(['c']);
  });
  it('returns nothing when no nutrient is flagged', () => {
    expect(suggestSwaps({ ...base, dish: B, profile })).toEqual([]);
    expect(suggestSwaps({ ...base, profile: makeProfile() })).toEqual([]);
  });
  it('never suggests the same dish', () => {
    expect(suggestSwaps({ ...base, profile }).map((s) => s.dishId)).not.toContain('a');
  });
});
```

**Done when:** green. **Commit:** `feat(engine): swap suggestions for flagged nutrients`

---

## P2-A02 Shopping list

**Depends on:** P0-X03 · **Branch:** `a/P2-A02-shopping`

**Files:** create `packages/engine/src/shopping.ts`, `packages/engine/test/shopping.test.ts`; edit `index.ts`.

**Spec:**

```ts
import type { Dish, ShoppingItem } from '@sp/contracts';
/** Returns raw ingredient grams for N servings, water excluded, grams rounded to 0.1, sorted by grams descending then id. Throws RangeError unless servings is an integer from 1 to 20. */
export function buildShoppingList(dish: Dish, servings: number): ShoppingItem[];
```

**Tests (write first):**

```ts
import { describe, it, expect } from 'vitest';
import { makeDish } from '@sp/contracts/testing';
import { buildShoppingList } from '../src/shopping';
const l = (id: string, g: number) => ({
  ingredient_id: id,
  grams_raw: g,
  quantity_basis: 'ESTIMATE' as const,
});
const d = makeDish({
  id: 'd',
  ingredients: [l('rice', 100), l('water', 300), l('salt', 2.55), l('oil', 100)],
}) as never;
describe('buildShoppingList', () => {
  it('scales by servings, drops water, sorts by grams then id', () => {
    expect(buildShoppingList(d, 2)).toEqual([
      { ingredientId: 'oil', grams: 200 },
      { ingredientId: 'rice', grams: 200 },
      { ingredientId: 'salt', grams: 5.1 },
    ]);
  });
  it('rejects bad servings', () => {
    for (const n of [0, 21, 1.5, -1]) expect(() => buildShoppingList(d, n)).toThrow(RangeError);
  });
});
```

**Done when:** green. **Commit:** `feat(engine): shopping list from dish ingredients`

---

## P2-A03 Label analysis

**Depends on:** P1-A04 · **Blocks:** A04 · **Branch:** `a/P2-A03-label`

**Goal:** analyze a scanned label for allergens (declared and found in the ingredient text) and nutrient rules per 100 g.

**Files:** create `packages/engine/src/label.ts`, `packages/engine/test/label.test.ts`; edit `index.ts`.

**Spec:**

```ts
import type { Allergen, HealthRule, NutrientValues, UserProfile, Warning } from '@sp/contracts';
export type AllergenKeywords = Record<Allergen, string[]>; // lowercase words; matching is by substring (conservative on purpose)
export interface LabelInput {
  ingredientsText: string | null;
  declaredAllergens: Allergen[];
  nutritionPer100g: Partial<NutrientValues> | null;
}
export interface DetectedAllergen {
  allergen: Allergen;
  via: 'declared' | 'ingredients';
}
/** Returns declared allergens plus any allergen whose keyword appears in the ingredients text (case-insensitive substring). Declared wins when both apply. */
export function detectAllergens(
  label: Pick<LabelInput, 'ingredientsText' | 'declaredAllergens'>,
  keywords: AllergenKeywords,
): DetectedAllergen[];
/** Returns warnings: allergen conflicts first (params allergen and via), then nutrient-rule warnings evaluated per 100 g (params basis 'per_100g'). */
export function analyzeLabel(args: {
  label: LabelInput;
  profile: UserProfile;
  rules: HealthRule[];
  keywords: AllergenKeywords;
}): { warnings: Warning[]; detected: DetectedAllergen[] };
```

Build a `NutritionResult` from `nutritionPer100g` (nutrient present gives `{ value, coverage: 1, shown: true, origin: 'calculated' }`, absent gives `{ value: null, coverage: 0, shown: false, origin: 'none' }`; `null` nutrition gives all absent), call `evaluateSuitability` with no dish allergens, no cooking class and no tags, then add `basis: 'per_100g'` to each nutrient warning's params. Substring matching is deliberate: a false alarm is safe, a miss is not.

**Tests (write first):**

```ts
import { describe, it, expect } from 'vitest';
import type { HealthRule } from '@sp/contracts';
import { makeProfile } from '@sp/contracts/testing';
import { detectAllergens, analyzeLabel, type AllergenKeywords } from '../src/label';

const kw: AllergenKeywords = {
  milk: ['milk', 'whey'],
  egg: ['egg'],
  fish: ['fish'],
  crustacean_shellfish: ['prawn'],
  tree_nuts: ['cashew'],
  peanuts: ['peanut'],
  wheat_gluten: ['wheat', 'flour'],
  soy: ['soy'],
  sesame: ['sesame'],
  mustard: ['mustard'],
};
const rule: HealthRule = {
  kind: 'nutrient',
  id: 'htn',
  condition: 'hypertension',
  nutrient: 'sodium_mg',
  dailyLimit: 2000,
  cautionFraction: 0.3,
  avoidFraction: 0.6,
  messageKey: 'warn.sodium_high',
  sourceRef: 'S',
  status: 'draft',
};

describe('detectAllergens', () => {
  it('finds allergens in the ingredient text', () => {
    expect(
      detectAllergens({ ingredientsText: 'Wheat flour, Whey powder', declaredAllergens: [] }, kw)
        .map((d) => d.allergen)
        .sort(),
    ).toEqual(['milk', 'wheat_gluten']);
  });
  it('prefers declared over ingredient detection', () => {
    expect(detectAllergens({ ingredientsText: 'milk', declaredAllergens: ['milk'] }, kw)).toEqual([
      { allergen: 'milk', via: 'declared' },
    ]);
  });
  it('is conservative: soybean matches soy', () => {
    expect(
      detectAllergens({ ingredientsText: 'soybean oil', declaredAllergens: [] }, kw)[0],
    ).toEqual({ allergen: 'soy', via: 'ingredients' });
  });
  it('handles missing text', () => {
    expect(detectAllergens({ ingredientsText: null, declaredAllergens: [] }, kw)).toEqual([]);
  });
});
describe('analyzeLabel', () => {
  const label = {
    ingredientsText: 'flour, whey',
    declaredAllergens: [],
    nutritionPer100g: { sodium_mg: 700 },
  };
  it('warns about an allergen the user has, with its source of detection', () => {
    const r = analyzeLabel({
      label,
      profile: makeProfile({ allergies: ['milk'] }),
      rules: [rule],
      keywords: kw,
    });
    expect(r.warnings[0]).toMatchObject({ kind: 'allergen', level: 'avoid', allergen: 'milk' });
    expect(r.warnings[0]?.params).toEqual({ allergen: 'milk', via: 'ingredients' });
  });
  it('evaluates nutrient rules per 100 g and tags the basis', () => {
    const w = analyzeLabel({
      label,
      profile: makeProfile({ conditions: ['hypertension'] }),
      rules: [rule],
      keywords: kw,
    }).warnings;
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ level: 'caution' });
    expect(w[0]?.params).toMatchObject({ nutrient: 'sodium_mg', percent: 35, basis: 'per_100g' });
  });
  it('reports insufficient data when the label has no nutrition', () => {
    const w = analyzeLabel({
      label: { ...label, nutritionPer100g: null },
      profile: makeProfile({ conditions: ['hypertension'] }),
      rules: [rule],
      keywords: kw,
    }).warnings;
    expect(w[0]?.messageKey).toBe('warn.insufficient_data');
  });
  it('says nothing for a profile with no conditions and no allergies', () => {
    expect(
      analyzeLabel({ label, profile: makeProfile(), rules: [rule], keywords: kw }).warnings,
    ).toEqual([]);
  });
});
```

**Done when:** green. **Commit:** `feat(engine): label analysis with conservative allergen detection`

---

## P2-A04 `analyze()` orchestrator and golden test

**Depends on:** P2-A01, P2-A02, P2-A03, P1-A03 · **Blocks:** P3-X02 · **Branch:** `a/P2-A04-analyze`

**Goal:** the one function the UI calls.

**Files:** create `packages/engine/src/analyze.ts`, `packages/engine/test/analyze.test.ts`, `packages/engine/test/golden.test.ts`; edit `index.ts`, `packages/engine/package.json` (dev dependency `@sp/knowledge`: `workspace:*`; **tests only**, `src/` never imports it).

**Spec:**

```ts
import type {
  AnalysisResult,
  Dish,
  HealthRule,
  Ingredient,
  SafetyRule,
  ScanContext,
  SpoilageSign,
  UserProfile,
} from '@sp/contracts';
import type { AllergenKeywords, LabelInput } from './label';
export interface AnalyzeInput {
  scanKind: 'dish' | 'label';
  dishId: string | null; // required when scanKind is 'dish'
  dishes: Dish[];
  ingredients: Map<string, Ingredient>;
  observations: { spoilageSigns: SpoilageSign[]; imageQuality: 'good' | 'poor' };
  context: ScanContext;
  label: (LabelInput & { expiryDate: string | null }) | null;
  profile: UserProfile;
  safetyRules: SafetyRule[];
  healthRules: HealthRule[];
  allergenKeywords: AllergenKeywords;
  today: string;
  servings?: number; // default 1
}
export function analyze(input: AnalyzeInput): AnalysisResult;
```

Dish path: look up the dish (throw `Error('Unknown dish: <id>')` if missing) then `computeNutrition`, `scoreSafety` (dish tags, label `null`), `evaluateSuitability`, `suggestSwaps`, `buildShoppingList(dish, servings ?? 1)`. Label path: `dishId: null`, `nutrition: null`, safety with `dishTags: []` and the label expiry, warnings from `analyzeLabel`, `swaps: []`, `shoppingList: []`. The result must pass `AnalysisResultSchema`.

**Tests (write first):** `analyze.test.ts` with small fixtures (reuse the patterns from A01, A03, A04): (1) dish path returns all five parts and validates with `AnalysisResultSchema.parse`; (2) unknown dish id throws; (3) label path returns `dishId: null`, `nutrition: null`, empty `swaps` and `shoppingList`; (4) `servings: 2` doubles the shopping list grams; (5) same input gives deep-equal output twice.

`golden.test.ts` (uses the **real data** through `@sp/knowledge` `getDishes()` and `getIngredients()`, with fixture rules defined in the test):

```ts
// For every real dish, for three profiles (empty; hypertension + diabetes; allergies of all ten kinds):
//  1. analyze() does not throw and the result passes AnalysisResultSchema.
//  2. JSON.stringify(result) contains neither "NaN" nor "Infinity" nor "undefined".
//  3. For the all-allergies profile, a dish whose allergens are non-empty has an 'allergen' warning FIRST.
//  4. For every dish, nutrition.perServing.* has shown === (coverage >= 0.8).
//  5. Calling analyze twice gives deep-equal results.
```

Write this as real code with `describe.each`/loops over `getDishes()`.

**Done when:** green. **Commit:** `feat(engine): analyze orchestrator with golden test over all dishes`

---

# TRACK B: AI and API

## P2-B01 `POST /api/scan` for dishes

**Depends on:** P1-B01, P1-B02, P1-B03 · **Blocks:** B02, B03, P3-X01 · **Branch:** `b/P2-B01-scan-route`

**Goal:** the scan endpoint, wired to a provider chosen by environment.

**Files:** create `apps/api/src/scan-route.ts`, `apps/api/src/provider.ts`, `apps/api/test/scan-route.test.ts`, `apps/api/test/provider.test.ts`; edit `apps/api/src/app.ts`, `config.ts`, `worker.ts`, `node.ts`, `apps/api/package.json` (dependencies `@sp/ai`, `@sp/knowledge`).

**Spec:**

- `AppConfig` gains optional `provider?: VisionProvider` and `dishes?: DishPromptEntry[]` (so the P1 tests still compile). With no provider the route answers 503 `ai_unavailable`.
- `provider.ts`: `providerFromEnv(env: Env): VisionProvider`. `AI_PROVIDER` unset or `mock` returns `MockProvider`. `gemini` requires `GEMINI_API_KEY` and `GEMINI_MODEL`, otherwise it **throws an Error naming the missing variable** (fail fast, no silent fallback to mock). Any other value throws.
- `worker.ts` and `node.ts` build the app with `provider: providerFromEnv(env)` and `dishes` from `getDishes()` mapped to `{ id, name_en, name_bn, aliases }`.
- Route: invalid JSON gives 400 `bad_request`; schema failure gives 400 with a message made of `path: message` pairs only (never the submitted values); call `runScan`; if `result.kind !== request.kind` give 502 `ai_invalid_output`. Errors: `RateLimitedError` 429 `rate_limited`, `AiUnavailableError` 502 `ai_unavailable`, `AiInvalidOutputError` 502 `ai_invalid_output`, anything else 500 `internal` with a generic message. **The response and the logs never contain `imageBase64`.**

**Tests (write first):**

```ts
import { describe, it, expect } from 'vitest';
import { ApiErrorSchema, ScanResultSchema } from '@sp/contracts';
import {
  MockProvider,
  AiUnavailableError,
  AiInvalidOutputError,
  RateLimitedError,
  type VisionProvider,
} from '@sp/ai';
import { createApp } from '../src/app';

const IMG = 'Z'.repeat(300);
const body = (over: object = {}) =>
  JSON.stringify({
    kind: 'dish',
    imageBase64: IMG,
    mimeType: 'image/jpeg',
    context: { place: 'home', storage: 'unknown', hoursSinceCooked: null },
    ...over,
  });
const post = (app: ReturnType<typeof createApp>, b: string) =>
  app.request('/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: b,
  });
const dishes = [{ id: 'kacchi-biryani', name_en: 'Kacchi Biryani', name_bn: '', aliases: [] }];
const cfg = (provider?: VisionProvider) => ({
  allowedOrigin: 'http://x',
  maxBodyBytes: 2_000_000,
  provider,
  dishes,
});
const throwing = (e: Error): VisionProvider => ({
  name: 't',
  analyze: async () => {
    throw e;
  },
});

describe('POST /api/scan', () => {
  it('returns a valid ScanResult with the mock provider', async () => {
    const res = await post(createApp(cfg(new MockProvider())), body());
    expect(res.status).toBe(200);
    expect(ScanResultSchema.safeParse(await res.json()).success).toBe(true);
  });
  it('rejects invalid JSON and a smuggled profile with 400', async () => {
    const app = createApp(cfg(new MockProvider()));
    expect((await post(app, '{oops')).status).toBe(400);
    const res = await post(app, body({ profile: { conditions: ['diabetes'] } }));
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(ApiErrorSchema.safeParse(JSON.parse(text)).success).toBe(true);
    expect(text).not.toContain('diabetes');
  });
  it('never echoes the image', async () => {
    const res = await post(createApp(cfg(new MockProvider())), body());
    expect(await res.text()).not.toContain(IMG);
  });
  it.each([
    [new RateLimitedError('x'), 429, 'rate_limited'],
    [new AiUnavailableError('x'), 502, 'ai_unavailable'],
    [new AiInvalidOutputError('x'), 502, 'ai_invalid_output'],
    [new Error('secret detail'), 500, 'internal'],
  ] as const)('maps %s', async (err, status, code) => {
    const res = await post(createApp(cfg(throwing(err))), body());
    expect(res.status).toBe(status);
    const j = await res.json();
    expect(j.error.code).toBe(code);
    expect(JSON.stringify(j)).not.toContain('secret detail');
  });
  it('answers 503 when no provider is configured', async () => {
    expect((await post(createApp(cfg(undefined)), body())).status).toBe(503);
  });
});
```

```ts
// provider.test.ts
import { describe, it, expect } from 'vitest';
import { providerFromEnv } from '../src/provider';
describe('providerFromEnv', () => {
  it('defaults to mock', () => {
    expect(providerFromEnv({}).name).toBe('mock');
  });
  it('requires key and model for gemini', () => {
    expect(() => providerFromEnv({ AI_PROVIDER: 'gemini' })).toThrow('GEMINI_API_KEY');
    expect(() => providerFromEnv({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' })).toThrow(
      'GEMINI_MODEL',
    );
    expect(
      providerFromEnv({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' }).name,
    ).toBe('gemini');
  });
  it('rejects unknown providers', () => {
    expect(() => providerFromEnv({ AI_PROVIDER: 'foo' })).toThrow();
  });
});
```

**Done when:** green. **Commit:** `feat(api): scan route with provider selection and error mapping`

---

## P2-B02 Label path and result sanity

**Depends on:** P2-B01 · **Branch:** `b/P2-B02-label-path`

**Files:** create `apps/api/src/sanitize.ts`, `apps/api/test/label-route.test.ts`, `apps/api/test/sanitize.test.ts`; edit `apps/api/src/scan-route.ts`.

**Spec:** `sanitizeLabelResult(r: LabelScanResult): LabelScanResult` sets `expiryDate` to `null` when the year is outside 2020 to 2100 or the date is not a real calendar date; trims `ingredientsText` to 2000 characters. The route applies it to label results.

**Tests (write first):**

```ts
// sanitize.test.ts
import { describe, it, expect } from 'vitest';
import { sanitizeLabelResult } from '../src/sanitize';
const base = {
  kind: 'label' as const,
  productName: null,
  ingredientsText: 'x',
  declaredAllergens: [],
  expiryDate: '2026-12-01',
  nutritionPer100g: null,
  observations: { spoilageSigns: [], imageQuality: 'good' as const, notes: '' },
  provider: 'm',
  cached: false,
};
describe('sanitizeLabelResult', () => {
  it('keeps a plausible date', () => {
    expect(sanitizeLabelResult(base).expiryDate).toBe('2026-12-01');
  });
  it.each(['1999-01-01', '2101-01-01', '2026-02-31', '2026-13-01'])('drops %s', (d) => {
    expect(sanitizeLabelResult({ ...base, expiryDate: d }).expiryDate).toBeNull();
  });
  it('trims very long text', () => {
    expect(
      sanitizeLabelResult({ ...base, ingredientsText: 'a'.repeat(5000) }).ingredientsText,
    ).toHaveLength(2000);
  });
});
```

`label-route.test.ts` (real code): a label request through the mock provider returns `kind: 'label'`; a provider that returns a **dish** result for a **label** request gives 502 `ai_invalid_output`.

**Done when:** green. **Commit:** `feat(api): label path with result sanity checks`

---

## P2-B03 Cache and guards

**Depends on:** P2-B01 · **Branch:** `b/P2-B03-cache-guards`

**Goal:** protect the free AI quota: cache results by image hash and cap daily calls.

**Files:** create `packages/ai/src/cache.ts`, `packages/ai/src/budget.ts`, `packages/ai/test/cache.test.ts`, `packages/ai/test/budget.test.ts`; edit `packages/ai/src/index.ts`, `apps/api/src/scan-route.ts`, `apps/api/src/config.ts` (optional `cache`, `budget`; env `DAILY_AI_BUDGET`, default 200), `apps/api/test/scan-route.test.ts` (add cases).

**Spec:**

```ts
export interface ScanCache {
  get(key: string): Promise<ScanResult | null>;
  set(key: string, value: ScanResult, ttlSeconds: number): Promise<void>;
}
export class MemoryScanCache implements ScanCache {
  constructor(now?: () => number); /* ... */
}
/** SHA-256 hex over kind, mimeType and imageBase64 (not the context). Uses globalThis.crypto.subtle. */
export async function imageCacheKey(req: ScanRequest): Promise<string>;

export interface BudgetGuard {
  tryConsume(): boolean;
  remaining(): number;
}
/** In-memory daily counter keyed by UTC day. Best effort: resets when the worker restarts. */
export function createBudgetGuard(opts: { maxPerDay: number; now?: () => number }): BudgetGuard;
```

Route: compute the key; on a cache hit return `{ ...cached, cached: true }` **without consuming the budget**; on a miss, `tryConsume()` (false gives 429 `rate_limited` with message "Daily AI limit reached"), call `runScan`, cache the result for 24 h, return it.

**Tests (write first):**

```ts
// cache.test.ts
import { describe, it, expect } from 'vitest';
import { MemoryScanCache, imageCacheKey } from '../src/cache';
const req = (img: string, kind: 'dish' | 'label' = 'dish') => ({
  kind,
  imageBase64: img.padEnd(200, 'A'),
  mimeType: 'image/jpeg' as const,
  context: { place: 'home' as const, storage: 'unknown' as const, hoursSinceCooked: null },
});
describe('imageCacheKey', () => {
  it('is stable and 64 hex chars', async () => {
    const a = await imageCacheKey(req('x'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await imageCacheKey(req('x'))).toBe(a);
  });
  it('differs by image and by kind', async () => {
    expect(await imageCacheKey(req('x'))).not.toBe(await imageCacheKey(req('y')));
    expect(await imageCacheKey(req('x'))).not.toBe(await imageCacheKey(req('x', 'label')));
  });
});
describe('MemoryScanCache', () => {
  const val = {
    kind: 'dish' as const,
    candidates: [{ dishId: null, label: 'x', confidence: 0.1 }],
    observations: { spoilageSigns: [], imageQuality: 'good' as const, notes: '' },
    provider: 'm',
    cached: false,
  };
  it('returns a stored value until it expires', async () => {
    let t = 0;
    const c = new MemoryScanCache(() => t);
    await c.set('k', val, 10);
    expect(await c.get('k')).toEqual(val);
    t = 11_000;
    expect(await c.get('k')).toBeNull();
  });
});
```

```ts
// budget.test.ts
import { describe, it, expect } from 'vitest';
import { createBudgetGuard } from '../src/budget';
describe('createBudgetGuard', () => {
  it('allows up to the maximum then refuses', () => {
    const g = createBudgetGuard({ maxPerDay: 2, now: () => 0 });
    expect([g.tryConsume(), g.tryConsume(), g.tryConsume()]).toEqual([true, true, false]);
    expect(g.remaining()).toBe(0);
  });
  it('resets on a new UTC day', () => {
    let t = Date.UTC(2026, 9, 26, 23, 59);
    const g = createBudgetGuard({ maxPerDay: 1, now: () => t });
    expect(g.tryConsume()).toBe(true);
    expect(g.tryConsume()).toBe(false);
    t = Date.UTC(2026, 9, 27, 0, 1);
    expect(g.tryConsume()).toBe(true);
  });
});
```

Route test additions (real code): second identical request returns `cached: true` and the provider is called once; with `maxPerDay: 1` a second **different** image gives 429, but repeating the first image still succeeds.

**Done when:** green. **Commit:** `feat(ai,api): image-hash cache and daily budget guard`

---

## P2-B04 Production config and deploy notes

**Depends on:** P1-B04, P2-B01 · **Branch:** `b/P2-B04-prod-config`

**Files:** edit `apps/api/wrangler.toml` (remove `ENABLE_SPIKE`; `AI_PROVIDER = "gemini"` documented as a comment, secrets via commands), create `docs/DEPLOY.md`, `apps/api/test/prod-config.test.ts`.

**Spec:** `docs/DEPLOY.md` lists, in order: (1) `wrangler secret put GEMINI_API_KEY`; (2) set `GEMINI_MODEL` and `ALLOWED_ORIGIN` as vars; (3) deploy; (4) smoke test with `curl`; (5) rollback (`wrangler rollback` or redeploy the previous tag); (6) **Render fallback**: create a Render web service from the repo, build `pnpm install && pnpm --filter @sp/api build:node` (add a `build:node` script that bundles `src/node.ts` with `tsx`-free output, or run with `tsx` in start command), start `node dist/node.js`, set the same env vars, and set `ALLOWED_ORIGIN`. Check Cloudflare and Render docs for current command names; fix this file if they differ.

**Tests (write first):** read `wrangler.toml` as text and assert: it contains `main = "src/worker.ts"`, does **not** contain `ENABLE_SPIKE`, and does **not** contain any of `API_KEY =`, `SECRET`, `TOKEN =`.

**Done when:** green. **Commit:** `chore(api): production worker config and deploy runbook`

---

# TRACK C: Web (presentational, built against fixtures)

All C cards use fixtures in `apps/web/src/fixtures/` (create them in P2-C02): `analysis-kacchi.ts` (a full `AnalysisResult`), `analysis-label.ts`, `analysis-unknown-nutrition.ts` (all nutrients `shown: false`). Each fixture must pass `AnalysisResultSchema.parse` (add one test for that in P2-C02).

## P2-C01 Confirm-dish screen

**Depends on:** P1-C03, P1-C01 · **Branch:** `c/P2-C01-confirm`

**Files:** create `apps/web/src/lib/filter-dishes.ts`, `src/pages/Confirm.tsx`, `apps/web/test/filter-dishes.test.ts`, `confirm-page.test.tsx`; edit `App.tsx` (route `/confirm`).

**Spec:**

```ts
export interface DishOption {
  id: string;
  name_en: string;
  name_bn: string;
  aliases: string[];
}
/** Returns options whose English name, Bangla name or any alias contains the trimmed query (case-insensitive). Empty query returns all, sorted by the name in the given language. */
export function filterDishes(query: string, options: DishOption[], lang: 'en' | 'bn'): DishOption[];
```

Page: reads `{ result, thumbDataUrl }` from router state (missing state redirects to `/`). For a `dish` result show the top 3 candidates as large buttons ("Best guess" label on the first); if the top confidence is below 0.5 or `dishId` is null show the "We're not sure" message and focus the search box; search box lists all 30 dishes (from `@sp/knowledge` `getDishes()`); a "None of these" button. Choosing a dish navigates to `/result` with `{ scanResult, dishId, thumbDataUrl }`. For a `label` result, skip this screen and go straight to `/result` with `dishId: null`.

**Tests (write first):**

```ts
import { describe, it, expect } from 'vitest';
import { filterDishes } from '../src/lib/filter-dishes';
const opts = [
  { id: 'a', name_en: 'Kacchi Biryani', name_bn: 'কাচ্চি বিরিয়ানি', aliases: ['Kachchi'] },
  { id: 'b', name_en: 'Fuchka', name_bn: 'ফুচকা', aliases: ['Puchka'] },
];
describe('filterDishes', () => {
  it('matches English, case-insensitively and trimmed', () => {
    expect(filterDishes('  KACCHI ', opts, 'en').map((o) => o.id)).toEqual(['a']);
  });
  it('matches Bangla', () => {
    expect(filterDishes('ফুচ', opts, 'bn').map((o) => o.id)).toEqual(['b']);
  });
  it('matches aliases', () => {
    expect(filterDishes('puchka', opts, 'en').map((o) => o.id)).toEqual(['b']);
  });
  it('returns all, sorted, for an empty query', () => {
    expect(filterDishes('', opts, 'en').map((o) => o.id)).toEqual(['b', 'a']);
  });
});
```

`confirm-page.test.tsx` (real code): renders at most 3 candidate buttons for a fixture dish result; typing in the search narrows the list; clicking a candidate navigates to `/result` (use `MemoryRouter` with a stub route that renders the router state's `dishId`); with confidence 0.3 the "not sure" text appears.

**Done when:** green. **Commit:** `feat(web): confirm-dish screen with search`

---

## P2-C02 Result screen: Safety and For you

**Depends on:** P1-C04 · **Branch:** `c/P2-C02-result-safety`

**Files:** create `apps/web/src/fixtures/*.ts`, `src/components/SafetyCard.tsx`, `ForYouCard.tsx`, `src/pages/Result.tsx` (tabs shell taking `analysis` and `dish` as props through a `ResultView` component; the page wires data in P3-X02), `apps/web/test/fixtures.test.ts`, `safety-card.test.tsx`, `foryou-card.test.tsx`.

**Spec:**

- `SafetyCard({ safety })`: `RiskGauge`, `EvidenceList`, mitigation steps (`t(key)` list, heading `safety.next_steps`), and `NoticeBanner` for `safety.notices`. The notice is always visible.
- `ForYouCard({ warnings, hasProfile })`: warnings grouped as **Avoid**, **Caution**, **Info**; allergen warnings first and visually distinct; each shows `t(messageKey, params)`, an icon plus a word for the level (never colour alone), and a source chip when `sourceRef` exists. Empty list with a profile shows `foryou.none`; empty list without a profile shows `foryou.add_profile` with a link to `/settings`.
- `ResultView` tabs: Safety, For you, Nutrition, Swap (the last two are filled by C03 and C04; show placeholders until then).

**Tests (write first):** (1) each fixture passes `AnalysisResultSchema.parse`; (2) `SafetyCard` renders the chemical notice and the score; (3) `ForYouCard` renders an allergen warning before an `avoid` warning before a `caution` warning (assert DOM order by `getAllByRole('listitem')`); (4) empty states for with and without profile; (5) level is conveyed by text (`getByText('Avoid')`), not only by class names.

**Done when:** green. **Commit:** `feat(web): safety card, for-you card and result tabs`

---

## P2-C03 Result: Nutrition card

**Depends on:** P2-C02 · **Branch:** `c/P2-C03-nutrition-card`

**Files:** create `apps/web/src/components/NutritionCard.tsx`, `src/lib/nutrient-format.ts`, `apps/web/test/nutrient-format.test.ts`, `nutrition-card.test.tsx`; edit `ResultView` to mount it.

**Spec:**

```ts
export const NUTRIENT_DISPLAY: Record<
  NutrientKey,
  { labelKey: string; unit: string; decimals: number }
>;
// energy_kcal kcal 0 decimals, sodium_mg mg 0, all grams 1 decimal
/** Returns the number formatted for display, e.g. 435 or 12.5. */
export function formatNutrient(key: NutrientKey, value: number): string;
```

Card: heading with serving description and "about N g (estimated)"; a row per nutrient: label, value and unit **only when `shown`**, otherwise the text `t('nutrition.not_enough_data')`; a small coverage bar; `StatusBadge estimated` **always visible**; a footnote key `nutrition.estimate_note`; when `origin === 'lab_scaled'` a tag `nutrition.from_lab_study`; a short "Why is some data missing?" accordion (`nutrition.why_missing`).

**Tests (write first):**

```ts
import { describe, it, expect } from 'vitest';
import { formatNutrient } from '../src/lib/nutrient-format';
describe('formatNutrient', () => {
  it('rounds energy and sodium to whole numbers', () => {
    expect(formatNutrient('energy_kcal', 434.6)).toBe('435');
    expect(formatNutrient('sodium_mg', 12.4)).toBe('12');
  });
  it('uses one decimal for grams', () => {
    expect(formatNutrient('protein_g', 12.46)).toBe('12.5');
  });
});
```

`nutrition-card.test.tsx` (real code): with the all-hidden fixture no number is rendered and the not-enough-data text appears 8 times; the estimated badge is present in every fixture; a `lab_scaled` nutrient shows the lab tag; a nutrient with `shown: true` shows its formatted value and unit.

**Done when:** green. **Commit:** `feat(web): nutrition card that hides numbers without coverage`

---

## P2-C04 Result: Swap and shopping

**Depends on:** P2-C02 · **Branch:** `c/P2-C04-swap-shopping`

**Files:** create `apps/web/src/components/SwapList.tsx`, `ShoppingList.tsx`, `apps/web/test/swap-shopping.test.tsx`; edit `ResultView`.

**Spec:** `SwapList({ swaps, dishNames })` shows up to 3 alternatives with the improved nutrients as chips and the text `t(reasonKey)`; empty state `swap.none`. `ShoppingList({ items, ingredientNames, servings, onServingsChange })`: a stepper from 1 to 10, one checkbox row per item with grams, and a **Copy list** button that writes plain text (one `name: Ng` line per item) through `navigator.clipboard.writeText` (guarded: if unavailable show the text in a selectable box). Checked state is local only.

**Tests (write first):** swap list renders chips and the empty state; the stepper calls `onServingsChange` with 2 after one click on "+" and never goes below 1 or above 10; Copy list calls `writeText` (mocked) with the expected multi-line text.

**Done when:** green. **Commit:** `feat(web): swap list and shopping list with copy`

---

## P2-C05 History and settings

**Depends on:** P1-C02, P2-C02 · **Branch:** `c/P2-C05-history-settings`

**Files:** create `apps/web/src/state/history-store.ts`, `apps/web/test/history-store.test.ts`; edit `src/pages/History.tsx`, `src/pages/Settings.tsx`.

**Spec:**

```ts
export const HISTORY_KEY = 'sp.history.v1';
export interface HistoryEntry {
  id: string;
  at: string;
  dishId: string | null;
  title: string;
  score: number;
  level: 'low' | 'moderate' | 'high';
  thumb: string | null;
}
export class HistoryStore {
  constructor(storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, max = 20);
  list(): HistoryEntry[];
  add(e: HistoryEntry): void;
  clear(): void;
}
```

`list()` returns newest first and ignores corrupt data. `add` keeps at most `max` entries, dropping the oldest. History page lists entries; Settings has: language switch, edit profile (reuse the onboarding form component), and **Delete my data**, which clears the profile **and** the history and shows a confirmation.

**Tests (write first):** newest first; capped at 20; corrupt JSON gives `[]`; `clear` removes the key; a Settings test that "Delete my data" removes both `sp.profile.v1` and `sp.history.v1`.

**Done when:** green. **Commit:** `feat(web): history store and settings with delete-my-data`

---

## P2-C06 Bangla UI, messages wiring and About

**Depends on:** P2-D04 (messages file) and P2-D01 (sources) for the real data; may start with fixtures · **Branch:** `c/P2-C06-bangla-about`

**Files:** create `apps/web/src/pages/About.tsx` (replace placeholder), `apps/web/test/i18n-keys.test.ts`; edit `src/main.tsx` (call `registerMessages(getMessages())` at startup), `src/i18n/ui-strings.ts`, `src/App.tsx` (persist language in the profile store).

**Spec:** About lists the sources from `getSources()` (title, publisher, tier, status as text), explains "estimated" and "draft", repeats the honest-limits notice, and shows the app version and the data freeze date.

**Tests (write first)** `i18n-keys.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { uiStrings } from '../src/i18n/ui-strings';
import { getMessages } from '@sp/knowledge';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [];
  });
const keys = new Set(
  files(root).flatMap((f) =>
    [...readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([a-z0-9_.]+)'/g)].map((m) => m[1]!),
  ),
);
describe('i18n keys used in components', () => {
  it('exist in both languages (ui strings or knowledge messages)', () => {
    const messages = getMessages();
    const missing = [...keys].filter(
      (k) => !((uiStrings.en[k] && uiStrings.bn[k]) || (messages[k]?.en && messages[k]?.bn)),
    );
    expect(missing).toEqual([]);
  });
});
```

**Done when:** green. **Commit:** `feat(web): bangla ui, knowledge messages and about page`

---

# TRACK D: Data

## P2-D01 Source register

**Depends on:** P1-D01 · **Blocks:** D02, D03, C06 · **Branch:** `d/P2-D01-sources`

**Goal:** a register of the sources behind every rule and number, each opened and checked by the agent.

**Files:** create `packages/knowledge/data/sources.json`, `packages/knowledge/test/sources.test.ts`, `tools/src/check-sources.ts`; edit `packages/knowledge/src/index.ts` (add `getSources()`), `tools/package.json` (script `check-sources`).

**Spec:** start from this list (ids in `kebab-case`). Set `status: "unverified"` and `accessedOn: null` for all. Then run `check-sources`, which tries to fetch each URL and, **only if the page loads and the title or publisher matches**, sets `status: "verified"` and `accessedOn` to the run date. If the network is unavailable, leave everything `unverified` and report. Never mark a source verified without opening it.

| id                      | title                                                 | publisher                                        | tier       | url                                                                                                             |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------- |
| `bd-dietary-guidelines` | National Dietary Guidelines for Bangladesh            | National Nutrition Services (copy hosted by WHO) | bangladesh | `https://cdn.who.int/media/docs/default-source/searo/bangladesh/national-dietary-guidelines-for-bangladesh.pdf` |
| `bd-fctb-2013`          | Food Composition Table for Bangladesh                 | INFS, University of Dhaka (via FAO)              | data       | the FCTB URL in `ingredients.json` metadata                                                                     |
| `bd-safe-food-act-2013` | Safe Food Act 2013                                    | Government of Bangladesh (FAOLEX copy)           | bangladesh | `https://faolex.fao.org/docs/pdf/bgd153882.pdf`                                                                 |
| `bd-bfsa`               | Bangladesh Food Safety Authority                      | BFSA                                             | bangladesh | `https://bfsa.gov.bd/`                                                                                          |
| `bd-bsti`               | Bangladesh Standards and Testing Institution          | BSTI                                             | bangladesh | `https://www.bsti.gov.bd/`                                                                                      |
| `who-nugag`             | WHO nutrition guidance (NUGAG) guidelines             | World Health Organization                        | global     | `https://www.who.int/groups/nutrition-guidance-expert-advisory-group-(nugag)`                                   |
| `codex-texts`           | Codex Alimentarius standards and codes                | FAO/WHO                                          | global     | `https://www.fao.org/fao-who-codexalimentarius/codex-texts`                                                     |
| `usda-fdc`              | USDA FoodData Central                                 | USDA                                             | data       | `https://fdc.nal.usda.gov/`                                                                                     |
| `infs-cooked-dishes`    | INFS studies of cooked Bangladeshi dishes (BanglaJOL) | University of Dhaka                              | data       | the BanglaJOL article URLs the team collected (add ids per paper)                                               |

Add any further **official** source you find, as `unverified`, and list it in the report for human approval. No blogs, news or social posts.

**Tests (write first)** `packages/knowledge/test/sources.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SourcesFileSchema } from '@sp/contracts';
import { getSources } from '../src';
describe('sources register', () => {
  const list = getSources();
  it('validates and has unique ids', () => {
    expect(SourcesFileSchema.safeParse({ sources: list }).success).toBe(true);
    expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
  });
  it('contains the core sources', () => {
    for (const id of ['bd-dietary-guidelines', 'bd-fctb-2013', 'who-nugag', 'codex-texts'])
      expect(list.some((s) => s.id === id)).toBe(true);
  });
  it('a verified source has an access date', () => {
    for (const s of list) if (s.status === 'verified') expect(s.accessedOn).not.toBeNull();
  });
});
```

**Done when:** green; paste the check-sources output. **Commit:** `feat(knowledge): source register with verification script`

---

## P2-D02 Safety rules from sources (proposals)

**Depends on:** P2-D01 · **Blocks:** D06 · **Branch:** `d/P2-D02-safety-proposals`

**Goal:** draft safety rules, each tied to a **cited section** of an official source. Proposals only; an expert approves.

**Files:** create `packages/knowledge/data/proposals/safety-rules-proposals.json`, `packages/knowledge/test/safety-proposals.test.ts`.

**Spec:** read the verified food-hygiene sources (Codex general principles of food hygiene, BFSA regulations and any official storage guidance you can open). For each rule you propose, fill `basis` with a **short paraphrase and the section or page** (never a long quote). **If no official source supports a rule, do not write it.** Candidate rules, only where a source supports them: `spoilage_sign` rules for the 8 signs (food that shows signs of spoilage is not to be eaten), `storage_hours` rules (only if a source states an explicit time limit; copy the number and its section), `label_expired`, and `dish_tag` rules for the six tags (only with a source). Points are **team heuristics** (suggested ranges: spoilage sign 30 to 40, expired label 50, storage limit exceeded 25, dish tag 5 to 10); note this in the file's top-level `"note"` field. All rules have `status: "draft"`. Keys: `labelKey` as `safety.<id>`, mitigation keys as `mitigation.<slug>` (for example `mitigation.discard`).

**Tests (write first):**

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { SafetyRulesFileSchema } from '@sp/contracts';
import { getSources } from '../src';
const file = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../data/proposals/safety-rules-proposals.json', import.meta.url)),
    'utf8',
  ),
);
describe('safety rule proposals', () => {
  const rules = SafetyRulesFileSchema.parse({ rules: file.rules }).rules;
  const ids = new Set(getSources().map((s) => s.id));
  it('has at least one rule and unique ids', () => {
    expect(rules.length).toBeGreaterThan(0);
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
  });
  it('every rule is draft, cited, and explained', () => {
    for (const r of rules) {
      expect(r.status).toBe('draft');
      expect(r.sourceRef && ids.has(r.sourceRef)).toBeTruthy();
      expect(r.basis && r.basis.length > 10).toBeTruthy();
    }
  });
  it('uses the key conventions', () => {
    for (const r of rules) {
      expect(r.labelKey.startsWith('safety.')).toBe(true);
      for (const m of r.mitigationKeys) expect(m.startsWith('mitigation.')).toBe(true);
    }
  });
});
```

**Done when:** green. **Commit:** `feat(knowledge): draft safety rule proposals with citations`

---

## P2-D03 Health rules from sources (proposals)

**Depends on:** P2-D01 · **Blocks:** D06 · **Branch:** `d/P2-D03-health-proposals`

**Goal:** draft condition rules for diabetes, hypertension, high cholesterol and gastric problems, from the Bangladesh guidelines first and WHO second (Bangladesh wins on conflict).

**Files:** create `packages/knowledge/data/proposals/health-rules-proposals.json`, `packages/knowledge/data/proposals/health-rules-conflicts.json`, `packages/knowledge/test/health-proposals.test.ts`.

**Spec:** a `nutrient` rule needs a `dailyLimit` **stated in a source in grams or milligrams** (or a source-stated gram equivalent of a percentage). Never convert a percentage of energy yourself. If a source gives only a percentage, skip that nutrient and list it in the report. `cautionFraction` 0.3 and `avoidFraction` 0.6 are **team heuristics** (a single serving providing 30 or 60 percent of the daily limit); put them in a top-level `"note"` for the expert. `tag` rules only where a source supports them. High cholesterol and gastric problems may end up with **no** rules if no source supports them; that is expected, report it. Disagreements between a Bangladesh source and WHO go to `health-rules-conflicts.json` as `{ topic, bangladesh, who }` (short paraphrases with sections), and the **Bangladesh value is used**. All rules `status: "draft"`; `messageKey` as `warn.<slug>`.

**Tests (write first):** same shape as D02: file passes `HealthRulesFileSchema`; unique ids; every `sourceRef` exists in `getSources()`; every rule is `draft`; every nutrient rule has `dailyLimit > 0` and `basis` of more than 10 characters; every rule's condition is one of the four; `health-rules-conflicts.json` parses as an array.

**Done when:** green; paste the list of conditions with no rules. **Commit:** `feat(knowledge): draft health rule proposals from bangladesh and who guidance`

---

## P2-D04 Allergen keywords and messages

**Depends on:** P2-D02, P2-D03 (to know every key) · **Blocks:** C06 · **Branch:** `d/P2-D04-messages`

**Goal:** the keyword list used to find allergens in ingredient text, and every message the app shows, in English and Bangla.

**Files:** create `packages/knowledge/data/allergen-keywords.json`, `packages/knowledge/data/messages.json`, `packages/knowledge/src/messages.ts`, `packages/knowledge/test/messages.test.ts`; edit `packages/knowledge/src/index.ts` (add `getMessages()` and `getAllergenKeywords()`).

**Spec:**

- `allergen-keywords.json`: `Record<Allergen, string[]>`, lowercase words in English **and Bangla script** (examples to start from: milk: milk, whey, casein, ghee, paneer, curd, yogurt, দুধ, ঘি, ছানা, দই; egg: egg, ডিম; fish: fish, hilsa, ilish, rui, মাছ, ইলিশ; shellfish: prawn, shrimp, চিংড়ি; wheat_gluten: wheat, flour, maida, atta, semolina, ময়দা, আটা, সুজি; tree_nuts: cashew, almond, pistachio, walnut, কাজু, বাদাম; peanuts: peanut, groundnut, চিনাবাদাম; soy: soy, soya; sesame: sesame, til, তিল; mustard: mustard, সরিষা). A native speaker must review it (P2-DH01). Missing a keyword never means the allergen is absent; the UI says so.
- `messages.json`: a key for every `labelKey`, `mitigationKeys`, `messageKey` in the proposal files, plus: `warn.allergen_present`, `warn.insufficient_data`, `notice.chemical_limit` (the **exact** text in `TECH_DESIGN.md` §8), `notice.poor_image`, `safety.level.low|moderate|high`, `safety.no_signals`, `safety.next_steps`, `foryou.none`, `foryou.add_profile`, `swap.lower_nutrient`, `swap.none`, `nutrition.not_enough_data`, `nutrition.estimate_note`, `nutrition.from_lab_study`, `nutrition.why_missing`, `badge.estimated`, `badge.draft`, `onboarding.consent`, and the eight nutrient labels. English wording rules: say "may not suit you", "consider limiting", "check with your doctor"; **never** "will cause", "cure", "treat", "diagnose". Bangla drafts by the agent are **drafts**; humans fix them. Placeholders (`{allergen}`, `{percent}`, `{nutrient}`) must be identical in both languages.

**Tests (write first)** `messages.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MessagesFileSchema, SafetyRulesFileSchema, HealthRulesFileSchema } from '@sp/contracts';
import { getMessages, getAllergenKeywords } from '../src';
import safety from '../data/proposals/safety-rules-proposals.json';
import health from '../data/proposals/health-rules-proposals.json';

const m = getMessages();
const ph = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)]
    .map((x) => x[1])
    .sort()
    .join(',');
describe('messages', () => {
  it('validates and has both languages everywhere', () => {
    expect(MessagesFileSchema.safeParse(m).success).toBe(true);
  });
  it('has every key referenced by the rule proposals', () => {
    const rules = SafetyRulesFileSchema.parse({ rules: safety.rules }).rules;
    const hr = HealthRulesFileSchema.parse({ rules: health.rules }).rules;
    const keys = [
      ...rules.flatMap((r) => [r.labelKey, ...r.mitigationKeys]),
      ...hr.map((r) => r.messageKey),
      'warn.allergen_present',
      'warn.insufficient_data',
      'notice.chemical_limit',
      'notice.poor_image',
    ];
    expect(keys.filter((k) => !m[k])).toEqual([]);
  });
  it('keeps placeholders identical in en and bn', () => {
    for (const [k, v] of Object.entries(m)) expect(ph(v.bn), k).toBe(ph(v.en));
  });
  it('avoids forbidden claims in English', () => {
    for (const [k, v] of Object.entries(m))
      expect(v.en, k).not.toMatch(/will cause|\bcure\b|\btreat\b|diagnos/i);
  });
  it('carries the exact chemical-limit notice', () => {
    expect(m['notice.chemical_limit']?.en).toContain(
      'cannot detect invisible chemical contamination',
    );
  });
  it('has bangla text that differs from english', () => {
    for (const [k, v] of Object.entries(m))
      if (!/^[\W\d_]*$/.test(v.en)) expect(v.bn, k).not.toBe(v.en);
  });
});
describe('allergen keywords', () => {
  it('covers all ten allergens with at least one English and one Bangla keyword', () => {
    const k = getAllergenKeywords();
    expect(Object.keys(k)).toHaveLength(10);
    for (const [a, words] of Object.entries(k)) {
      expect(
        words.some((w) => /^[a-z ]+$/.test(w)),
        a,
      ).toBe(true);
      expect(
        words.some((w) => /[\u0980-\u09FF]/.test(w)),
        a,
      ).toBe(true);
    }
  });
});
```

**Done when:** green. **Commit:** `feat(knowledge): allergen keywords and bilingual messages`

---

## P2-D05 Evaluation manifest and checker

**Depends on:** P0-X03 · **Blocks:** P3-X05 · **Branch:** `d/P2-D05-eval`

**Goal:** a manifest format for the team's test photos and pure metric functions. The photos stay out of git.

**Files:** create `tools/src/eval-lib.ts`, `tools/test/eval-lib.test.ts`, `eval/README.md`, `eval/manifest.example.json`; edit `.gitignore` (add `eval/photos/`).

**Spec:**

```ts
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
/** top1 and top3 accuracy over dish items that have an expectedDishId; unknownRate is the share whose first candidate has dishId null. */
export function dishMetrics(
  items: EvalItem[],
  preds: DishPrediction[],
): { n: number; top1: number; top3: number; unknownRate: number };
/** micro precision and recall over allergens, plus the exact-match rate of expiry dates, for label items. */
export function labelMetrics(
  items: EvalItem[],
  preds: LabelPrediction[],
): { n: number; allergenPrecision: number; allergenRecall: number; expiryExact: number };
```

When a denominator is 0 return `0` (never `NaN`). Items without a prediction count as a miss.

**Tests (write first):**

```ts
import { describe, it, expect } from 'vitest';
import { dishMetrics, labelMetrics, type EvalItem } from '../src/eval-lib';
const d = (file: string, id: string): EvalItem => ({
  file,
  kind: 'dish',
  split: 'dev',
  expectedDishId: id,
});
describe('dishMetrics', () => {
  const items = [d('1', 'a'), d('2', 'b'), d('3', 'c'), d('4', 'd')];
  const preds = [
    { file: '1', candidates: [{ dishId: 'a' }] },
    { file: '2', candidates: [{ dishId: 'x' }, { dishId: 'b' }] },
    { file: '3', candidates: [{ dishId: null }] },
  ];
  it('computes top1, top3, unknown rate; a missing prediction is a miss', () => {
    expect(dishMetrics(items, preds)).toEqual({ n: 4, top1: 0.25, top3: 0.5, unknownRate: 0.25 });
  });
  it('returns zeros, not NaN, for no items', () => {
    expect(dishMetrics([], [])).toEqual({ n: 0, top1: 0, top3: 0, unknownRate: 0 });
  });
});
describe('labelMetrics', () => {
  const items: EvalItem[] = [
    {
      file: 'l1',
      kind: 'label',
      split: 'dev',
      expectedAllergens: ['milk', 'egg'],
      expectedExpiry: '2026-12-01',
    },
  ];
  it('computes precision, recall and expiry exactness', () => {
    const m = labelMetrics(items, [
      { file: 'l1', declaredAllergens: ['milk', 'fish'], expiryDate: '2026-12-01' },
    ]);
    expect(m).toEqual({ n: 1, allergenPrecision: 0.5, allergenRecall: 0.5, expiryExact: 1 });
  });
});
```

**Done when:** green. **Commit:** `feat(tools): evaluation manifest and pure metrics`

---

## P2-D07 Review pack export (CSV for the expert)

**Depends on:** P1-D04 · **Branch:** `d/P2-D07-review-pack`

**Goal:** CSV files a nutritionist can open in Excel: dishes with quantities, draft rules, cooking classes, allergens.

**Files:** create `tools/src/csv.ts`, `tools/src/export-review-pack.ts`, `tools/test/csv.test.ts`; edit `tools/package.json` (script `review-pack`). Output to `data/review/` (gitignored? **committed**, small).

**Spec:** `toCsv(rows: Array<Record<string, string | number | null>>, columns: string[]): string` writes a UTF-8 file with a BOM (`\uFEFF`) so Excel shows Bangla correctly; fields containing commas, quotes or newlines are quoted and quotes doubled; `null` becomes an empty field; rows end with `\r\n`. The script writes `dishes-review.csv` (dish id, English and Bangla name, serving description, serving weight g, one row per ingredient with grams, cooking class, allergens, safety tags, nutrition basis, an empty "expert decision" column), `rules-review.csv` (rule id, type, condition or trigger, numbers, source, basis, status, empty "expert decision" column).

**Tests (write first):**

```ts
import { describe, it, expect } from 'vitest';
import { toCsv } from '../src/csv';
describe('toCsv', () => {
  it('writes a BOM, header and CRLF rows', () => {
    expect(toCsv([{ a: 1, b: 'x' }], ['a', 'b'])).toBe('\uFEFFa,b\r\n1,x\r\n');
  });
  it('quotes commas, quotes and newlines', () => {
    expect(toCsv([{ a: 'x,y', b: 'say "hi"' }], ['a', 'b'])).toBe(
      '\uFEFFa,b\r\n"x,y","say ""hi"""\r\n',
    );
    expect(toCsv([{ a: 'l1\nl2' }], ['a'])).toBe('\uFEFFa\r\n"l1\nl2"\r\n');
  });
  it('writes null as empty and keeps Bangla intact', () => {
    expect(toCsv([{ a: null, b: 'ইলিশ' }], ['a', 'b'])).toBe('\uFEFFa,b\r\n,ইলিশ\r\n');
  });
});
```

**Done when:** green; run `review-pack` and give the files to the nutritionist. **Commit:** `feat(tools): csv review pack for the expert`

---

## P2-DH01 [HUMAN] Expert and language review (book the session today)

- [ ] Give the nutritionist or doctor `data/review/dishes-review.csv` and `rules-review.csv`. Ask them to mark **keep / change / remove** for: ingredient gram quantities (start with the demo dishes), serving weights, cooking classes, allergen lists per dish, and every draft rule (does the cited section really say that? is the wording safe?).
- [ ] A native Bangla speaker reads `messages.json` and fixes the `bn` text; another checks `allergen-keywords.json` for missing common words.
- [ ] Record decisions by editing the proposal files (set `status` to `approved` for accepted rules, delete rejected ones) and the data files where numbers changed. Commit on `d/P2-DH01-review`.
- [ ] If the expert is not available before the deadline: keep everything `draft` and let the app show the draft and estimated badges (it already does). Say so in the video.

---

## P2-D06 Apply approvals and decide the coverage gate

**Depends on:** P2-DH01, P1-D04 · **Branch:** `d/P2-D06-merge-gate`

**Goal:** turn proposals into the live rules files and decide which dishes show numbers.

**Files:** create `tools/src/merge-rules.ts`, `tools/src/merge-lib.ts`, `tools/src/demo-gate.ts`, `tools/test/merge-lib.test.ts`; generated: `packages/knowledge/data/rules/safety-rules.json`, `health-rules.json`, `packages/knowledge/data/runtime/demo-dishes.json`; edit `packages/knowledge/src/index.ts` (add `getSafetyRules()`, `getHealthRules()`, `getDemoDishIds()`), `tools/package.json` (scripts `merge-rules`, `demo-gate`).

**Spec:**

```ts
/** Merges proposal rules into a final list. Throws if a rule's sourceRef is missing or not in the register, or if ids are duplicated. Keeps each rule's status exactly as written. */
export function mergeRules<T extends { id: string; sourceRef: string | null }>(
  proposals: T[],
  sourceIds: Set<string>,
): T[];
/** Returns the ids of dishes whose energy coverage is at least minCoverage, sorted. */
export function demoDishIds(
  coverageByDish: Array<{ dishId: string; energyCoverage: number }>,
  minCoverage?: number,
): string[];
```

`demo-gate.ts` computes coverage with `computeNutrition` from the engine and writes `demo-dishes.json` as `{ minCoverage: 0.8, dishIds: [...] }`. The UI shows a "full nutrition" tag for those dishes and "partial data" for the rest. **Report the list.** If fewer than 10 dishes pass, tell the team immediately: the demo uses these dishes, and the others still show safety and allergen results.

**Tests (write first):**

```ts
import { describe, it, expect } from 'vitest';
import { mergeRules, demoDishIds } from '../src/merge-lib';
describe('mergeRules', () => {
  const ok = { id: 'r1', sourceRef: 's1', status: 'draft' };
  it('keeps statuses and order', () => {
    expect(
      mergeRules([ok, { id: 'r2', sourceRef: 's1', status: 'approved' }], new Set(['s1'])).map(
        (r) => r.status,
      ),
    ).toEqual(['draft', 'approved']);
  });
  it('throws for an unknown or missing source', () => {
    expect(() => mergeRules([{ id: 'r', sourceRef: 'nope' }], new Set(['s1']))).toThrow('r');
    expect(() => mergeRules([{ id: 'r', sourceRef: null }], new Set(['s1']))).toThrow('r');
  });
  it('throws for duplicate ids', () => {
    expect(() => mergeRules([ok, ok], new Set(['s1']))).toThrow('r1');
  });
});
describe('demoDishIds', () => {
  it('keeps dishes at or above the gate, sorted', () => {
    expect(
      demoDishIds([
        { dishId: 'b', energyCoverage: 0.8 },
        { dishId: 'a', energyCoverage: 0.95 },
        { dishId: 'c', energyCoverage: 0.79 },
      ]),
    ).toEqual(['a', 'b']);
  });
});
```

**Done when:** green; commit the generated files; paste the gate list. **Commit:** `feat(tools): merge approved rules and decide the demo dish gate`
