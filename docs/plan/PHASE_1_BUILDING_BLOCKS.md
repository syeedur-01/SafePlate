# PHASE 1: Building blocks (Sat Oct 24 to Sun Oct 25)

**Goal:** each track builds its module on its own, against the contracts and mocks from Phase 0. Nobody waits for anybody.

**Exit criteria:** all P1 cards merged; `pnpm check` green on `main`; tag `phase-1-done`.

**Dependencies at a glance:**

| Track        | Order                                                                       | Notes                        |
| ------------ | --------------------------------------------------------------------------- | ---------------------------- |
| A Engine     | A01 → A02 → A03 → A04                                                       | A04 uses A01 and A02         |
| B AI and API | B01 and B02 in parallel → B03 (needs B02) · B04 (needs B01, human involved) | B04 is the day-1 risk test   |
| C Web        | C01 → C02, C03, C04 in parallel                                             | C04 needs the contracts only |
| D Data       | D01 → D02 and D03 in parallel → DH01 (human) → D04 (needs A01)              | D is the critical path       |

Every card below starts from a clean `main` (AGENTS.md section 2). Track letter in branch names is lowercase: `a/P1-A01-nutrition`.

---

# TRACK A: Engine (`packages/engine`)

## P1-A01 Nutrition computation (coverage-aware)

**Depends on:** P0-X03 · **Blocks:** A04, D04, P2-A04 · **Branch:** `a/P1-A01-nutrition`

**Goal:** compute per-serving nutrients for a dish, with coverage, exactly as `TECH_DESIGN.md` section 4.1.

**Read:** `TECH_DESIGN.md` §4.1; `packages/contracts/src/knowledge.ts`, `analysis.ts`.

**Files:** create `packages/engine/src/nutrition.ts`, `packages/engine/test/nutrition.test.ts`; edit `packages/engine/src/index.ts` (export), `packages/engine/package.json` (add `@sp/contracts`: `workspace:*`).

**Spec:**

```ts
import type { RawDish, Ingredient, NutritionResult } from '@sp/contracts';
export const MIN_COVERAGE = 0.8;
export function computeNutrition(
  dish: RawDish,
  ingredients: Map<string, Ingredient>,
  options?: { minCoverage?: number },
): NutritionResult;
```

- Skip ingredient id `water` for value and coverage. Throw `Error('Unknown ingredient: <id>')` for any other id not in the map.
- `overallCoverage` is the coverage of `energy_kcal`.
- `missingIngredientIds`: non-water ingredient ids in the dish whose `energy_kcal` is `null`.
- `estimated` is always `true`.
- Lab path as in §4.1 (`lab_scaled`), falling back per nutrient to `calculated` when the lab value is null.

**Tests (write first):**

```ts
import { describe, it, expect } from 'vitest';
import { makeDish, makeIngredient } from '@sp/contracts/testing';
import { computeNutrition } from '../src/nutrition';

const map = (list: ReturnType<typeof makeIngredient>[]) => new Map(list.map((i) => [i.id, i]));
const line = (id: string, g: number) => ({
  ingredient_id: id,
  grams_raw: g,
  quantity_basis: 'ESTIMATE' as const,
});

describe('computeNutrition', () => {
  it('sums grams times value per 100 g', () => {
    const m = map([
      makeIngredient({ id: 'rice', energy_kcal: 345 }),
      makeIngredient({ id: 'oil', energy_kcal: 900 }),
    ]);
    const r = computeNutrition(
      makeDish({ id: 'd', ingredients: [line('rice', 100), line('oil', 10)] }),
      m,
    );
    expect(r.perServing.energy_kcal.value).toBeCloseTo(435);
    expect(r.perServing.energy_kcal.coverage).toBe(1);
    expect(r.perServing.energy_kcal.shown).toBe(true);
    expect(r.perServing.energy_kcal.origin).toBe('calculated');
    expect(r.estimated).toBe(true);
    expect(r.overallCoverage).toBe(1);
  });
  it('does not treat null as zero', () => {
    const m = map([
      makeIngredient({ id: 'rice', energy_kcal: 345 }),
      makeIngredient({ id: 'hilsa' }),
    ]);
    const r = computeNutrition(
      makeDish({ id: 'd', ingredients: [line('rice', 100), line('hilsa', 100)] }),
      m,
    );
    expect(r.perServing.energy_kcal.coverage).toBeCloseTo(0.5);
    expect(r.perServing.energy_kcal.shown).toBe(false);
    expect(r.perServing.energy_kcal.value).toBeCloseTo(345);
    expect(r.missingIngredientIds).toEqual(['hilsa']);
  });
  it('ignores water in value and coverage', () => {
    const m = map([
      makeIngredient({ id: 'rice', energy_kcal: 345 }),
      makeIngredient({ id: 'water' }),
    ]);
    const r = computeNutrition(
      makeDish({ id: 'd', ingredients: [line('rice', 100), line('water', 100)] }),
      m,
    );
    expect(r.perServing.energy_kcal.coverage).toBe(1);
    expect(r.missingIngredientIds).toEqual([]);
  });
  it('shows a nutrient at exactly the minimum coverage and hides it below', () => {
    const m = map([makeIngredient({ id: 'a', energy_kcal: 100 }), makeIngredient({ id: 'b' })]);
    const d = makeDish({ id: 'd', ingredients: [line('a', 80), line('b', 20)] });
    expect(computeNutrition(d, m).perServing.energy_kcal.shown).toBe(true);
    expect(computeNutrition(d, m, { minCoverage: 0.9 }).perServing.energy_kcal.shown).toBe(false);
  });
  it('returns null value and origin none when no ingredient has the nutrient', () => {
    const m = map([makeIngredient({ id: 'a', energy_kcal: 100 })]);
    const r = computeNutrition(makeDish({ id: 'd', ingredients: [line('a', 100)] }), m);
    expect(r.perServing.sat_fat_g).toEqual({
      value: null,
      coverage: 0,
      shown: false,
      origin: 'none',
    });
  });
  it('scales lab values from per 100 g cooked to the serving, falling back per nutrient', () => {
    const m = map([makeIngredient({ id: 'chicken', energy_kcal: 120 })]);
    const d = makeDish({
      id: 'roast',
      serving_weight_g: 300,
      nutrition_basis: 'lab_analyzed',
      ingredients: [line('chicken', 200)],
      lab_values_per_serving: {
        value_basis: 'per_100_g_cooked_as_published',
        values: {
          energy_kcal: null,
          protein_g: 10.9,
          fat_g: 22.3,
          sat_fat_g: null,
          carbs_g: 3.6,
          sugars_g: null,
          fibre_g: 0.5,
          sodium_mg: null,
        },
      },
    });
    const r = computeNutrition(d, m);
    expect(r.perServing.protein_g.value).toBeCloseTo(32.7);
    expect(r.perServing.protein_g.origin).toBe('lab_scaled');
    expect(r.perServing.protein_g.coverage).toBe(1);
    expect(r.perServing.energy_kcal.origin).toBe('calculated');
    expect(r.perServing.energy_kcal.value).toBeCloseTo(240);
  });
  it('throws on an unknown ingredient', () => {
    expect(() =>
      computeNutrition(makeDish({ id: 'd', ingredients: [line('nope', 10)] }), new Map()),
    ).toThrow('Unknown ingredient: nope');
  });
});
```

**Done when:** `pnpm --filter @sp/engine test` and `pnpm check` green. **Commit:** `feat(engine): coverage-aware nutrition computation`

**Pitfalls:** never convert `null` to `0`; never derive energy from macros; use `toBeCloseTo` for floats.

---

## P1-A02 Allergen conflicts

**Depends on:** P0-X03 · **Blocks:** A04 · **Branch:** `a/P1-A02-allergens`

**Goal:** find overlaps between the user's allergies and a dish's allergens and turn them into top-priority warnings.

**Files:** create `packages/engine/src/allergens.ts`, `packages/engine/test/allergens.test.ts`; edit `packages/engine/src/index.ts`.

**Spec:**

```ts
import type { Allergen, Warning } from '@sp/contracts';
/** Returns the user's allergens that appear in the dish, in the user's order, without duplicates. */
export function allergenConflicts(userAllergies: Allergen[], dishAllergens: Allergen[]): Allergen[];
/** Returns one `avoid` warning per conflicting allergen. */
export function allergenWarnings(userAllergies: Allergen[], dishAllergens: Allergen[]): Warning[];
```

Warning fields: `id: 'allergen:<name>'`, `kind: 'allergen'`, `level: 'avoid'`, `condition: null`, `allergen: <name>`, `messageKey: 'warn.allergen_present'`, `params: { allergen: <name> }`, `sourceRef: null`.

**Tests (write first):**

```ts
import { describe, it, expect } from 'vitest';
import { allergenConflicts, allergenWarnings } from '../src/allergens';

describe('allergenConflicts', () => {
  it('returns the overlap in the user order', () => {
    expect(allergenConflicts(['fish', 'milk', 'egg'], ['egg', 'milk'])).toEqual(['milk', 'egg']);
  });
  it('returns nothing when there is no overlap or no allergies', () => {
    expect(allergenConflicts(['fish'], ['milk'])).toEqual([]);
    expect(allergenConflicts([], ['milk'])).toEqual([]);
  });
  it('removes duplicates', () => {
    expect(allergenConflicts(['milk', 'milk'], ['milk', 'milk'])).toEqual(['milk']);
  });
});
describe('allergenWarnings', () => {
  it('builds avoid warnings', () => {
    const w = allergenWarnings(['milk'], ['milk', 'egg']);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({
      id: 'allergen:milk',
      kind: 'allergen',
      level: 'avoid',
      allergen: 'milk',
      messageKey: 'warn.allergen_present',
      condition: null,
      sourceRef: null,
    });
    expect(w[0]?.params).toEqual({ allergen: 'milk' });
  });
});
```

**Done when:** tests and `pnpm check` green. **Commit:** `feat(engine): allergen conflict warnings`

---

## P1-A03 Safety scoring

**Depends on:** P0-X03 · **Blocks:** P2-A04 · **Branch:** `a/P1-A03-safety`

**Goal:** score a scan from rules, with every point tied to evidence (`TECH_DESIGN.md` §4.2).

**Files:** create `packages/engine/src/safety.ts`, `packages/engine/test/safety.test.ts`; edit `packages/engine/src/index.ts`.

**Spec:**

```ts
import type { SafetyRule, SafetyResult, SafetyTag, SpoilageSign, ScanContext } from '@sp/contracts';
export const SAFETY_LEVEL_BOUNDS = { moderate: 25, high: 60 } as const;
export const CHEMICAL_LIMIT_NOTICE_KEY = 'notice.chemical_limit';
export const POOR_IMAGE_NOTICE_KEY = 'notice.poor_image';
export interface SafetyInput {
  dishTags: SafetyTag[];
  observations: { spoilageSigns: SpoilageSign[]; imageQuality: 'good' | 'poor' };
  context: ScanContext;
  label: { expiryDate: string | null } | null;
  today: string; // 'YYYY-MM-DD', injected, never read from the clock
}
export function scoreSafety(input: SafetyInput, rules: SafetyRule[]): SafetyResult;
```

Trigger logic:

- `spoilage_sign`: the sign is in `observations.spoilageSigns`. Evidence: `Photo shows: <sign>`.
- `storage_hours`: `context.storage === rule.storage`, `hoursSinceCooked !== null`, `hoursSinceCooked >= minHours`, and (`tags` undefined or one tag is in `dishTags`). Evidence: `Kept <storage> for <hours> h`.
- `dish_tag`: `dishTags` includes `tag`, and (`place` undefined or equals `context.place`). Evidence: `Dish category: <tag>`.
- `label_expired`: `label?.expiryDate` is non-null and `< today` (ISO strings compare lexicographically). Evidence: `Expiry date <date> has passed`.

`score = min(100, sum of points)`. Level: `< 25` low, `< 60` moderate, else high. `signals` in rule order. `mitigationKeys` unique, in first-seen order. `notices` always starts with `notice.chemical_limit`, plus `notice.poor_image` when `imageQuality === 'poor'`. `rulesStatus` is `'draft'` if **any rule passed in** is draft, else `'approved'`.

**Tests (write first):** the numbers below are **test fixtures only**, not real thresholds.

```ts
import { describe, it, expect } from 'vitest';
import type { SafetyRule } from '@sp/contracts';
import { scoreSafety, type SafetyInput } from '../src/safety';

const rule = (
  over: Pick<SafetyRule, 'id' | 'trigger' | 'points'> & Partial<SafetyRule>,
): SafetyRule => ({
  labelKey: `safety.${over.id}`,
  mitigationKeys: [],
  sourceRef: null,
  status: 'approved',
  ...over,
});
const base: SafetyInput = {
  dishTags: [],
  observations: { spoilageSigns: [], imageQuality: 'good' },
  context: { place: 'home', storage: 'unknown', hoursSinceCooked: null },
  label: null,
  today: '2026-10-25',
};
const mold = rule({
  id: 'mold',
  points: 40,
  trigger: { type: 'spoilage_sign', sign: 'visible_mold' },
  mitigationKeys: ['m.discard'],
  sourceRef: 'S1',
});

describe('scoreSafety', () => {
  it('scores 0 and low when nothing triggers, and always carries the chemical notice', () => {
    const r = scoreSafety(base, [mold]);
    expect(r).toMatchObject({ score: 0, level: 'low', signals: [] });
    expect(r.notices[0]).toBe('notice.chemical_limit');
  });
  it('adds points with evidence and source for a spoilage sign', () => {
    const r = scoreSafety(
      { ...base, observations: { spoilageSigns: ['visible_mold'], imageQuality: 'good' } },
      [mold],
    );
    expect(r.score).toBe(40);
    expect(r.level).toBe('moderate');
    expect(r.signals[0]).toMatchObject({
      ruleId: 'mold',
      points: 40,
      evidence: 'Photo shows: visible_mold',
      sourceRef: 'S1',
    });
    expect(r.mitigationKeys).toEqual(['m.discard']);
  });
  it('caps the score at 100', () => {
    const big = rule({
      id: 'big',
      points: 90,
      trigger: { type: 'spoilage_sign', sign: 'slimy_surface' },
    });
    const r = scoreSafety(
      {
        ...base,
        observations: { spoilageSigns: ['visible_mold', 'slimy_surface'], imageQuality: 'good' },
      },
      [mold, big],
    );
    expect(r.score).toBe(100);
    expect(r.level).toBe('high');
  });
  it.each([
    [24, 'low'],
    [25, 'moderate'],
    [59, 'moderate'],
    [60, 'high'],
  ] as const)('score %i is %s', (points, level) => {
    const r = scoreSafety(
      { ...base, observations: { spoilageSigns: ['visible_mold'], imageQuality: 'good' } },
      [rule({ id: 'p', points, trigger: { type: 'spoilage_sign', sign: 'visible_mold' } })],
    );
    expect(r.level).toBe(level);
  });
  it('triggers a storage rule at exactly minHours, not before, not for other storage, not for null hours', () => {
    const s = rule({
      id: 's',
      points: 20,
      trigger: { type: 'storage_hours', storage: 'room_temp', minHours: 4 },
    });
    const ctx = (storage: 'room_temp' | 'refrigerated', h: number | null) => ({
      ...base,
      context: { place: 'home' as const, storage, hoursSinceCooked: h },
    });
    expect(scoreSafety(ctx('room_temp', 4), [s]).score).toBe(20);
    expect(scoreSafety(ctx('room_temp', 3.9), [s]).score).toBe(0);
    expect(scoreSafety(ctx('refrigerated', 10), [s]).score).toBe(0);
    expect(scoreSafety(ctx('room_temp', null), [s]).score).toBe(0);
  });
  it('respects the dish tag filter on a storage rule', () => {
    const s = rule({
      id: 's',
      points: 20,
      trigger: { type: 'storage_hours', storage: 'room_temp', minHours: 2, tags: ['dairy'] },
    });
    const c = { place: 'home' as const, storage: 'room_temp' as const, hoursSinceCooked: 5 };
    expect(scoreSafety({ ...base, context: c, dishTags: ['dairy'] }, [s]).score).toBe(20);
    expect(scoreSafety({ ...base, context: c, dishTags: ['fried'] }, [s]).score).toBe(0);
  });
  it('triggers dish tag rules, optionally limited by place', () => {
    const t = rule({
      id: 't',
      points: 10,
      trigger: { type: 'dish_tag', tag: 'street-food', place: 'street' },
    });
    expect(
      scoreSafety(
        { ...base, dishTags: ['street-food'], context: { ...base.context, place: 'street' } },
        [t],
      ).score,
    ).toBe(10);
    expect(scoreSafety({ ...base, dishTags: ['street-food'] }, [t]).score).toBe(0);
  });
  it('flags an expired label using the injected date', () => {
    const e = rule({ id: 'e', points: 50, trigger: { type: 'label_expired' } });
    expect(scoreSafety({ ...base, label: { expiryDate: '2026-10-24' } }, [e]).score).toBe(50);
    expect(scoreSafety({ ...base, label: { expiryDate: '2026-10-25' } }, [e]).score).toBe(0);
    expect(scoreSafety({ ...base, label: { expiryDate: null } }, [e]).score).toBe(0);
    expect(scoreSafety({ ...base, label: null }, [e]).score).toBe(0);
  });
  it('adds a poor-image notice and marks draft status when any rule is draft', () => {
    const r = scoreSafety({ ...base, observations: { spoilageSigns: [], imageQuality: 'poor' } }, [
      rule({ id: 'd', points: 5, status: 'draft', trigger: { type: 'label_expired' } }),
    ]);
    expect(r.notices).toEqual(['notice.chemical_limit', 'notice.poor_image']);
    expect(r.rulesStatus).toBe('draft');
  });
  it('lists each mitigation key once', () => {
    const a = rule({
      id: 'a',
      points: 5,
      trigger: { type: 'spoilage_sign', sign: 'visible_mold' },
      mitigationKeys: ['m.x', 'm.y'],
    });
    const b = rule({
      id: 'b',
      points: 5,
      trigger: { type: 'spoilage_sign', sign: 'visible_mold' },
      mitigationKeys: ['m.y'],
    });
    expect(
      scoreSafety(
        { ...base, observations: { spoilageSigns: ['visible_mold'], imageQuality: 'good' } },
        [a, b],
      ).mitigationKeys,
    ).toEqual(['m.x', 'm.y']);
  });
});
```

**Done when:** green. **Commit:** `feat(engine): evidence-based safety scoring`

**Pitfalls:** no `Date.now()`; thresholds in rules come from the data cards (D), never hardcoded here. No rule triggered means "low", never "safe".

---

## P1-A04 Suitability warnings

**Depends on:** P1-A01, P1-A02 · **Blocks:** P2-A04 · **Branch:** `a/P1-A04-suitability`

**Goal:** turn the user's conditions, the nutrition result and health rules into ordered warnings (§4.3).

**Files:** create `packages/engine/src/suitability.ts`, `packages/engine/test/suitability.test.ts`; edit `packages/engine/src/index.ts`.

**Spec:**

```ts
import type {
  Allergen,
  CookingClass,
  HealthRule,
  NutritionResult,
  SafetyTag,
  UserProfile,
  Warning,
} from '@sp/contracts';
export function evaluateSuitability(args: {
  profile: UserProfile;
  dishAllergens: Allergen[];
  cookingClass: CookingClass | null;
  safetyTags: SafetyTag[];
  nutrition: NutritionResult | null;
  rules: HealthRule[];
}): Warning[];
```

- Allergen warnings from `allergenWarnings` first.
- Nutrient rules for the user's conditions only. If `nutrition` is `null` or the nutrient is not `shown`: `info` warning `{ id: 'insufficient:<ruleId>', messageKey: 'warn.insufficient_data', params: { nutrient } }`. Otherwise `fraction = value / dailyLimit`; `>= avoidFraction` gives `avoid`, `>= cautionFraction` gives `caution`, else nothing. Params `{ nutrient, percent: Math.round(fraction * 100) }`.
- Tag rules: fire when `cookingClass` is in `match.cookingClasses`, or one of `safetyTags` is in `match.safetyTags`.
- Order: allergen warnings, then `avoid`, `caution`, `info`; ties by `id`.

**Tests (write first)** (rule numbers are test fixtures only):

```ts
import { describe, it, expect } from 'vitest';
import type { NutritionResult, HealthRule, NutrientKey } from '@sp/contracts';
import { makeProfile } from '@sp/contracts/testing';
import { evaluateSuitability } from '../src/suitability';

const nr = (value: number | null, shown = true) => ({
  value,
  coverage: shown ? 1 : 0.2,
  shown,
  origin: 'calculated' as const,
});
const nutrition = (
  over: Partial<Record<NutrientKey, ReturnType<typeof nr>>> = {},
): NutritionResult => ({
  perServing: {
    energy_kcal: nr(null, false),
    protein_g: nr(null, false),
    fat_g: nr(null, false),
    sat_fat_g: nr(null, false),
    carbs_g: nr(null, false),
    sugars_g: nr(null, false),
    fibre_g: nr(null, false),
    sodium_mg: nr(null, false),
    ...over,
  },
  overallCoverage: 1,
  missingIngredientIds: [],
  estimated: true,
});
const sodiumRule: HealthRule = {
  kind: 'nutrient',
  id: 'htn-sodium',
  condition: 'hypertension',
  nutrient: 'sodium_mg',
  dailyLimit: 2000,
  cautionFraction: 0.3,
  avoidFraction: 0.6,
  messageKey: 'warn.sodium_high',
  sourceRef: 'S1',
  status: 'draft',
};
const fryRule: HealthRule = {
  kind: 'tag',
  id: 'chol-fried',
  condition: 'high_cholesterol',
  match: { cookingClasses: ['deep_fried'] },
  level: 'caution',
  messageKey: 'warn.fried',
  sourceRef: 'S2',
  status: 'draft',
};
const args = (over: object = {}) => ({
  profile: makeProfile({ conditions: ['hypertension'] }),
  dishAllergens: [],
  cookingClass: null,
  safetyTags: [],
  nutrition: nutrition({ sodium_mg: nr(100) }),
  rules: [sodiumRule, fryRule],
  ...over,
});

describe('evaluateSuitability', () => {
  it('says nothing when below the caution fraction', () => {
    expect(evaluateSuitability(args())).toEqual([]);
  });
  it('cautions at 35 percent and avoids at 65 percent of the daily limit', () => {
    const c = evaluateSuitability(args({ nutrition: nutrition({ sodium_mg: nr(700) }) }));
    expect(c[0]).toMatchObject({
      level: 'caution',
      messageKey: 'warn.sodium_high',
      sourceRef: 'S1',
      condition: 'hypertension',
    });
    expect(c[0]?.params).toEqual({ nutrient: 'sodium_mg', percent: 35 });
    expect(
      evaluateSuitability(args({ nutrition: nutrition({ sodium_mg: nr(1300) }) }))[0]?.level,
    ).toBe('avoid');
  });
  it('ignores rules for conditions the user does not have', () => {
    expect(
      evaluateSuitability(
        args({ profile: makeProfile(), nutrition: nutrition({ sodium_mg: nr(1900) }) }),
      ),
    ).toEqual([]);
  });
  it('reports insufficient data instead of guessing', () => {
    const w = evaluateSuitability(args({ nutrition: nutrition({ sodium_mg: nr(1900, false) }) }));
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({
      level: 'info',
      messageKey: 'warn.insufficient_data',
      id: 'insufficient:htn-sodium',
    });
    expect(w[0]?.params).toEqual({ nutrient: 'sodium_mg' });
    expect(evaluateSuitability(args({ nutrition: null }))[0]?.messageKey).toBe(
      'warn.insufficient_data',
    );
  });
  it('fires tag rules by cooking class', () => {
    const w = evaluateSuitability(
      args({
        profile: makeProfile({ conditions: ['high_cholesterol'] }),
        cookingClass: 'deep_fried',
      }),
    );
    expect(w.map((x) => x.id)).toEqual(['chol-fried']);
  });
  it('puts allergen warnings first, then avoid, caution, info', () => {
    const w = evaluateSuitability(
      args({
        profile: makeProfile({
          conditions: ['hypertension', 'high_cholesterol'],
          allergies: ['milk'],
        }),
        dishAllergens: ['milk'],
        cookingClass: 'deep_fried',
        nutrition: nutrition({ sodium_mg: nr(1300) }),
      }),
    );
    expect(w.map((x) => x.level)).toEqual(['avoid', 'avoid', 'caution']);
    expect(w[0]?.kind).toBe('allergen');
  });
});
```

**Done when:** green. **Commit:** `feat(engine): suitability warnings from health rules`

**Pitfalls:** wording is always "may not suit"; that lives in `messages.json` (D), not here. Never invent thresholds.

---

# TRACK B: AI and API (`packages/ai`, `apps/api`)

## P1-B01 API skeleton

**Depends on:** P0-X03 · **Blocks:** B04, P2-B01 · **Branch:** `b/P1-B01-api-skeleton`

**Goal:** a Hono app with `/api/health`, CORS for one origin, a body-size guard, and the standard error shape. Runnable on Node and exportable as a Cloudflare Worker.

**Files:** create `apps/api/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/app.ts`, `src/config.ts`, `src/worker.ts`, `src/node.ts`, `test/app.test.ts`, `test/config.test.ts`.
Dependencies (pin exact): `hono` (4.x), `@hono/node-server`, `@sp/contracts` (`workspace:*`). Scripts: `typecheck`, `test`, `"dev": "tsx watch src/node.ts"`.

**Spec:**

```ts
// config.ts
export interface AppConfig {
  allowedOrigin: string;
  maxBodyBytes: number;
}
export type Env = Record<string, string | undefined>;
/** Returns the config from environment variables with defaults (origin http://localhost:5173, 2000000 bytes). */
export function configFromEnv(env: Env): AppConfig;

// app.ts
import { Hono } from 'hono';
/** Returns the API app. Routes are added by later cards on top of this skeleton. */
export function createApp(config: AppConfig): Hono;
```

- `GET /api/health` returns `{ ok: true, version: '0.1.0' }`.
- CORS only for `config.allowedOrigin` (`hono/cors` with an origin function that returns the origin only when it matches).
- Middleware on `/api/*`: if `content-length` is above `maxBodyBytes`, return 413 with `{ error: { code: 'too_large', message } }`.
- `app.notFound` returns 404 with code `bad_request`; `app.onError` returns 500 with code `internal` and **never** echoes the error text or request body.
- `worker.ts`: `export default { fetch(request: Request, env: Env) { return createApp(configFromEnv(env)).fetch(request); } };`
- `node.ts`: starts `@hono/node-server` on `PORT` (default 8787) using `configFromEnv(process.env)`.

**Tests (write first):**

```ts
// test/app.test.ts
import { describe, it, expect } from 'vitest';
import { ApiErrorSchema } from '@sp/contracts';
import { createApp } from '../src/app';

const app = createApp({ allowedOrigin: 'http://localhost:5173', maxBodyBytes: 1000 });

describe('api skeleton', () => {
  it('answers /api/health', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: expect.any(String) });
  });
  it('returns the standard error shape for unknown routes', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.safeParse(await res.json()).success).toBe(true);
  });
  it('allows only the configured origin', async () => {
    const ok = await app.request('/api/health', { headers: { Origin: 'http://localhost:5173' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const bad = await app.request('/api/health', { headers: { Origin: 'https://evil.example' } });
    expect(bad.headers.get('access-control-allow-origin')).not.toBe('https://evil.example');
  });
  it('rejects a body above the limit with 413 and code too_large', async () => {
    const res = await app.request('/api/anything', {
      method: 'POST',
      headers: { 'content-length': '5000' },
      body: 'x'.repeat(10),
    });
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe('too_large');
  });
});
```

```ts
// test/config.test.ts
import { describe, it, expect } from 'vitest';
import { configFromEnv } from '../src/config';
describe('configFromEnv', () => {
  it('uses defaults', () => {
    expect(configFromEnv({})).toEqual({
      allowedOrigin: 'http://localhost:5173',
      maxBodyBytes: 2_000_000,
    });
  });
  it('reads overrides', () => {
    expect(configFromEnv({ ALLOWED_ORIGIN: 'https://x.pages.dev' }).allowedOrigin).toBe(
      'https://x.pages.dev',
    );
  });
});
```

**Done when:** green, and `pnpm --filter @sp/api dev` serves `/api/health` (paste a `curl` output in the report). **Commit:** `feat(api): hono skeleton with health, cors, size guard`

**Pitfalls:** do not import Node-only modules (`fs`, `path`) in `app.ts` or `config.ts`; only `node.ts` may use Node APIs. Never log request bodies.

---

## P1-B02 Provider interface, mock provider, JSON parsing

**Depends on:** P0-X04 · **Blocks:** B03, P2-B01 · **Branch:** `b/P1-B02-provider-core`

**Goal:** the provider contract, a deterministic mock, safe JSON parsing, and `runScan` with one retry.

**Files:** create `packages/ai/src/errors.ts`, `provider.ts`, `parse.ts`, `mock-provider.ts`, `run-scan.ts`, `index.ts` (edit), `packages/ai/test/parse.test.ts`, `run-scan.test.ts`, `mock-provider.test.ts`; edit `packages/ai/package.json` (add `@sp/contracts`).

**Spec:**

```ts
// errors.ts
export class ParseError extends Error {}
export class AiInvalidOutputError extends Error {}
export class AiUnavailableError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
export class RateLimitedError extends Error {}

// provider.ts
import type { ScanRequest } from '@sp/contracts';
export interface DishPromptEntry {
  id: string;
  name_en: string;
  name_bn: string;
  aliases: string[];
}
export interface ProviderContext {
  dishes: DishPromptEntry[];
}
export interface VisionProvider {
  readonly name: string;
  analyze(req: ScanRequest, ctx: ProviderContext): Promise<unknown>;
}

// parse.ts
/** Returns the JSON object found in model text (handles code fences and prose around it). Throws ParseError. */
export function parseModelJson(text: string): unknown;

// mock-provider.ts
/** Deterministic provider: picks a fixture from fixtures/mock-scan by kind and a hash of the image. */
export class MockProvider implements VisionProvider {
  readonly name = 'mock';
  constructor(opts?: { forceFixture?: string });
  analyze(req: ScanRequest, ctx: ProviderContext): Promise<unknown>;
}

// run-scan.ts
/** Calls the provider, validates the result, retries once, and sanitizes unknown dish ids to null. */
export async function runScan(
  provider: VisionProvider,
  req: ScanRequest,
  ctx: ProviderContext,
): Promise<ScanResult>;
```

`MockProvider` imports the six fixture JSON files statically (relative paths to `../../../fixtures/mock-scan/`). Dish requests choose among the four dish fixtures, label requests among the two label fixtures, by `sum of char codes of the first 50 characters of imageBase64` modulo the count. `forceFixture` (file stem, for example `dish-kacchi-biryani`) overrides.

`runScan`: up to 2 attempts. For each: `raw = await provider.analyze(...)`; if `raw` is a string, `parseModelJson` it; set `provider` to `provider.name` and `cached` to `false`; validate with `ScanResultSchema`. If both attempts fail validation, throw `AiInvalidOutputError`. Errors thrown by the provider itself are **not** retried. Then replace candidate `dishId`s not in `ctx.dishes` with `null`.

**Tests (write first):**

````ts
// parse.test.ts
import { describe, it, expect } from 'vitest';
import { parseModelJson } from '../src/parse';
import { ParseError } from '../src/errors';
describe('parseModelJson', () => {
  it('parses plain JSON', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
  });
  it('parses fenced JSON', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('parses JSON surrounded by prose', () => {
    expect(parseModelJson('Here you go: {"a":{"b":2}} thanks')).toEqual({ a: { b: 2 } });
  });
  it('throws ParseError on garbage', () => {
    expect(() => parseModelJson('no json here')).toThrow(ParseError);
  });
});
````

````ts
// run-scan.test.ts
import { describe, it, expect } from 'vitest';
import type { ScanRequest } from '@sp/contracts';
import { runScan } from '../src/run-scan';
import { AiInvalidOutputError } from '../src/errors';
import type { VisionProvider } from '../src/provider';

const req: ScanRequest = {
  kind: 'dish',
  imageBase64: 'A'.repeat(200),
  mimeType: 'image/jpeg',
  context: { place: 'home', storage: 'unknown', hoursSinceCooked: null },
};
const ctx = {
  dishes: [{ id: 'kacchi-biryani', name_en: 'Kacchi Biryani', name_bn: '', aliases: [] }],
};
const good = (id: string | null) => ({
  kind: 'dish',
  candidates: [{ dishId: id, label: 'x', confidence: 0.5 }],
  observations: { spoilageSigns: [], imageQuality: 'good', notes: '' },
  provider: 'ignored',
  cached: true,
});
const fake = (outputs: unknown[]) => {
  const state = { calls: 0 };
  const p: VisionProvider = {
    name: 'fake',
    analyze: async () => outputs[Math.min(state.calls++, outputs.length - 1)],
  };
  return { p, state };
};

describe('runScan', () => {
  it('validates and stamps provider and cached', async () => {
    const r = await runScan(fake([good('kacchi-biryani')]).p, req, ctx);
    expect(r.provider).toBe('fake');
    expect(r.cached).toBe(false);
  });
  it('accepts text output with fences', async () => {
    const r = await runScan(
      fake(['```json\n' + JSON.stringify(good('kacchi-biryani')) + '\n```']).p,
      req,
      ctx,
    );
    expect(r.kind).toBe('dish');
  });
  it('retries once on invalid output', async () => {
    const f = fake([{ nope: true }, good('kacchi-biryani')]);
    await runScan(f.p, req, ctx);
    expect(f.state.calls).toBe(2);
  });
  it('throws AiInvalidOutputError after two invalid outputs', async () => {
    await expect(runScan(fake([{ nope: true }]).p, req, ctx)).rejects.toThrow(AiInvalidOutputError);
  });
  it('replaces unknown dish ids with null', async () => {
    const r = await runScan(fake([good('made-up-dish')]).p, req, ctx);
    if (r.kind === 'dish') expect(r.candidates[0]?.dishId).toBeNull();
  });
  it('does not retry when the provider itself throws', async () => {
    const state = { calls: 0 };
    const p: VisionProvider = {
      name: 'x',
      analyze: async () => {
        state.calls++;
        throw new Error('boom');
      },
    };
    await expect(runScan(p, req, ctx)).rejects.toThrow('boom');
    expect(state.calls).toBe(1);
  });
});
````

```ts
// mock-provider.test.ts
import { describe, it, expect } from 'vitest';
import { ScanResultSchema } from '@sp/contracts';
import { MockProvider } from '../src/mock-provider';
const ctx = { dishes: [] };
const mk = (kind: 'dish' | 'label', img = 'B'.repeat(200)) => ({
  kind,
  imageBase64: img,
  mimeType: 'image/jpeg' as const,
  context: { place: 'home' as const, storage: 'unknown' as const, hoursSinceCooked: null },
});
describe('MockProvider', () => {
  it('returns valid results for both kinds', async () => {
    const m = new MockProvider();
    expect(ScanResultSchema.parse(await m.analyze(mk('dish'), ctx)).kind).toBe('dish');
    expect(ScanResultSchema.parse(await m.analyze(mk('label'), ctx)).kind).toBe('label');
  });
  it('is deterministic for the same input', async () => {
    const m = new MockProvider();
    expect(await m.analyze(mk('dish'), ctx)).toEqual(await m.analyze(mk('dish'), ctx));
  });
  it('can force a fixture', async () => {
    const r = ScanResultSchema.parse(
      await new MockProvider({ forceFixture: 'dish-mishti-doi-spoiled' }).analyze(mk('dish'), ctx),
    );
    expect(r.kind === 'dish' && r.observations.spoilageSigns).toContain('foam_or_bubbles');
  });
});
```

**Done when:** green. **Commit:** `feat(ai): provider interface, mock provider, parsing, runScan`

---

## P1-B03 Gemini provider

**Depends on:** P1-B02 · **Blocks:** P2-B01 · **Branch:** `b/P1-B03-gemini`

**Goal:** a real provider that never runs in tests, plus the two prompts.

**Files:** create `packages/ai/src/gemini-provider.ts`, `prompts.ts`, `packages/ai/test/gemini-provider.test.ts`, `prompts.test.ts`; edit `packages/ai/src/index.ts`.

**Read first:** Google's **current official** Gemini API docs for `generateContent` with an inline image and JSON output. The request shape below is the expected one; **if the current docs differ, adapt inside `gemini-provider.ts` only** and say so in the report. Model names and free-tier limits change: the model name comes from options, never hardcoded.

**Spec:**

```ts
export interface GeminiOptions {
  apiKey: string;
  model: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}
export class GeminiProvider implements VisionProvider {
  readonly name = 'gemini';
  constructor(opts: GeminiOptions);
  analyze(req: ScanRequest, ctx: ProviderContext): Promise<unknown>;
}
export function buildDishPrompt(ctx: ProviderContext, context: ScanContext): string;
export function buildLabelPrompt(): string;
```

Request: `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`, headers `content-type: application/json` and `x-goog-api-key: <key>`, body `{ contents: [{ role: 'user', parts: [{ text: <prompt> }, { inline_data: { mime_type, data } }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }`. Response text = joined `candidates[0].content.parts[*].text`, passed to `parseModelJson`. Status 429 → `RateLimitedError`; other non-2xx, network error or timeout (default 25000 ms via `AbortController`) → `AiUnavailableError`; empty text → `AiInvalidOutputError`. **Never log the key, the image or the response body.**

Prompts: the dish prompt lists every dish (`id`, English name, aliases), asks for JSON only with exactly `{"kind":"dish","candidates":[{"dishId","label","confidence"}],"observations":{"spoilageSigns","imageQuality","notes"}}`, `dishId` from the list or `null`, at most 3 candidates sorted by confidence, `spoilageSigns` only from the 8 allowed values, `notes` at most 300 characters, and states that it must describe only what is visible and give no health or safety advice. The label prompt asks for `{"kind":"label","productName","ingredientsText","declaredAllergens","expiryDate","nutritionPer100g","observations":{...}}` with `expiryDate` as `YYYY-MM-DD` or `null`, allergens only from the 10 allowed values, and `null` for anything not readable (never guess).

**Tests (write first):**

```ts
// gemini-provider.test.ts
import { describe, it, expect } from 'vitest';
import { GeminiProvider } from '../src/gemini-provider';
import { AiUnavailableError, RateLimitedError, AiInvalidOutputError } from '../src/errors';

const req = {
  kind: 'dish' as const,
  imageBase64: 'QUJD'.repeat(50),
  mimeType: 'image/jpeg' as const,
  context: { place: 'home' as const, storage: 'unknown' as const, hoursSinceCooked: null },
};
const ctx = {
  dishes: [{ id: 'kacchi-biryani', name_en: 'Kacchi Biryani', name_bn: '', aliases: ['Kacchi'] }],
};
const reply =
  (text: string, status = 200) =>
  async () =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status });

describe('GeminiProvider', () => {
  it('sends the model, key header, image and JSON mime type', async () => {
    let url = '';
    let init: RequestInit = {};
    const fetchFn = (async (u: string, i: RequestInit) => {
      url = u;
      init = i;
      return reply('{"a":1}')();
    }) as unknown as typeof fetch;
    const out = await new GeminiProvider({ apiKey: 'K', model: 'm-1', fetchFn }).analyze(req, ctx);
    expect(out).toEqual({ a: 1 });
    expect(url).toContain('/models/m-1:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('K');
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(JSON.stringify(body)).toContain(req.imageBase64);
    expect(JSON.stringify(body)).toContain('image/jpeg');
  });
  it('maps 429 to RateLimitedError', async () => {
    const p = new GeminiProvider({
      apiKey: 'K',
      model: 'm',
      fetchFn: reply('x', 429) as unknown as typeof fetch,
    });
    await expect(p.analyze(req, ctx)).rejects.toThrow(RateLimitedError);
  });
  it('maps 500 and network errors to AiUnavailableError', async () => {
    await expect(
      new GeminiProvider({
        apiKey: 'K',
        model: 'm',
        fetchFn: reply('x', 500) as unknown as typeof fetch,
      }).analyze(req, ctx),
    ).rejects.toThrow(AiUnavailableError);
    const boom = (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    await expect(
      new GeminiProvider({ apiKey: 'K', model: 'm', fetchFn: boom }).analyze(req, ctx),
    ).rejects.toThrow(AiUnavailableError);
  });
  it('maps empty text to AiInvalidOutputError', async () => {
    await expect(
      new GeminiProvider({
        apiKey: 'K',
        model: 'm',
        fetchFn: reply('') as unknown as typeof fetch,
      }).analyze(req, ctx),
    ).rejects.toThrow(AiInvalidOutputError);
  });
});
```

```ts
// prompts.test.ts
import { describe, it, expect } from 'vitest';
import { SPOILAGE_SIGNS } from '@sp/contracts';
import { buildDishPrompt, buildLabelPrompt } from '../src/prompts';
const ctx = {
  dishes: [
    { id: 'kacchi-biryani', name_en: 'Kacchi Biryani', name_bn: '', aliases: ['Kacchi'] },
    { id: 'fuchka', name_en: 'Fuchka', name_bn: '', aliases: [] },
  ],
};
const c = { place: 'home' as const, storage: 'unknown' as const, hoursSinceCooked: null };
describe('prompts', () => {
  it('lists every dish id and every spoilage sign', () => {
    const p = buildDishPrompt(ctx, c);
    for (const id of ['kacchi-biryani', 'fuchka']) expect(p).toContain(id);
    for (const s of SPOILAGE_SIGNS) expect(p).toContain(s);
    expect(p.toLowerCase()).toContain('json');
  });
  it('never mentions health conditions and stays short', () => {
    const p = buildDishPrompt(ctx, c) + buildLabelPrompt();
    expect(p.toLowerCase()).not.toContain('diabet');
    expect(p.length).toBeLessThan(9000);
  });
  it('label prompt demands null for unreadable fields', () => {
    expect(buildLabelPrompt().toLowerCase()).toContain('null');
  });
});
```

**Done when:** green (no network used). Then, as a **human step**, run the spike in P1-B04. **Commit:** `feat(ai): gemini vision provider and prompts`

---

## P1-B04 Workers deploy spike (human plus agent, the day-1 risk test)

**Depends on:** P1-B01 · **Branch:** `b/P1-B04-workers-spike`

**Goal:** prove on day one that (a) the API deploys to Cloudflare Workers, (b) a real phone-sized image upload does not hit the free CPU limit, and (c) the Gemini key works. **If (a) or (b) fails, switch the API host to Render** using `src/node.ts` (it needs no code change), and record that in `docs/SPIKE_RESULTS.md`.

**Files:** create `apps/api/wrangler.toml`, `apps/api/src/spike.ts`, `apps/api/test/spike.test.ts`, `tools/src/spike-gemini.ts`, `docs/SPIKE_RESULTS.md`; edit `apps/api/src/app.ts` (register the spike route only when `config.enableSpike` is true), `apps/api/src/config.ts` (`enableSpike` from env `ENABLE_SPIKE === '1'`, default false), `apps/api/package.json` (dev dependency `wrangler`, pinned).

**Spec:**

- `spike.ts`: route `POST /api/_spike/echo` accepts a JSON body parsed with `ScanRequestSchema` and returns `{ ok: true, base64Chars: <length>, ms: <elapsed> }`. No AI call.
- `wrangler.toml`:

```toml
name = "safeplate-api"
main = "src/worker.ts"
compatibility_date = "2025-09-01"   # if wrangler warns, follow its suggestion

[vars]
AI_PROVIDER = "mock"
ALLOWED_ORIGIN = "http://localhost:5173"
ENABLE_SPIKE = "1"
```

- `tools/src/spike-gemini.ts`: reads an image path from argv, builds a `ScanRequest`, calls `GeminiProvider` (key and model from env `GEMINI_API_KEY`, `GEMINI_MODEL`), prints the parsed result and elapsed milliseconds. This is **run by a human**, never in tests.
- `docs/SPIKE_RESULTS.md`: a template table the human fills in (date, Worker URL, payload size, HTTP status, CPU error yes/no, Gemini latency, decision: Cloudflare or Render).

**Tests (write first)** `apps/api/test/spike.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app';
const body = JSON.stringify({
  kind: 'dish',
  imageBase64: 'A'.repeat(300_000),
  mimeType: 'image/jpeg',
  context: { place: 'home', storage: 'unknown', hoursSinceCooked: null },
});
const post = (app: ReturnType<typeof createApp>) =>
  app.request('/api/_spike/echo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
describe('spike route', () => {
  it('is off by default', async () => {
    expect(
      (
        await post(
          createApp({ allowedOrigin: 'http://x', maxBodyBytes: 2_000_000, enableSpike: false }),
        )
      ).status,
    ).toBe(404);
  });
  it('echoes the payload size when enabled', async () => {
    const res = await post(
      createApp({ allowedOrigin: 'http://x', maxBodyBytes: 2_000_000, enableSpike: true }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).base64Chars).toBe(300_000);
  });
});
```

(Update the `AppConfig` type and the B01 tests so `enableSpike` is optional there.)

**Human steps (after the agent's branch is merged):**

1. `pnpm --filter @sp/api exec wrangler login`, then `... exec wrangler deploy`. Note the Worker URL.
2. `curl` the health route. Then send a **real phone photo downscaled to about 1000 px** (about 150 to 300 KB, base64 about 200 to 400 KB) to `/api/_spike/echo`. Check the Cloudflare dashboard for errors or "exceeded CPU" messages.
3. Run `pnpm --filter @sp/tools exec tsx src/spike-gemini.ts <image path>` with your key in `.env`. Record latency and quality.
4. Fill in `docs/SPIKE_RESULTS.md` and **tell the team the decision**.

**Done when:** tests green, deploy attempted, `SPIKE_RESULTS.md` filled in. **Commit:** `feat(api): workers deploy spike and gemini spike script`

**Pitfalls:** the spike route must stay off in production (`ENABLE_SPIKE` removed in P3-X04). Never commit a key. Check Cloudflare's current docs if a wrangler command differs from the above.

---

# TRACK C: Web (`apps/web`)

## P1-C01 Web scaffold and design system

**Depends on:** P0-X03 · **Blocks:** C02, C03, C04 · **Branch:** `c/P1-C01-web-scaffold`

**Goal:** a Vite + React + TypeScript + Tailwind app with router, light and dark tokens, five hand-written UI components (no shadcn CLI), and a tiny i18n helper.

**Files:** create everything under `apps/web/`: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `vitest.setup.ts`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/lib/cn.ts`, `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `tabs.tsx`, `accordion.tsx`, `src/i18n/i18n.tsx`, `src/pages/{Scan,History,Settings,About}.tsx` (placeholders), `test/cn.test.ts`, `test/i18n.test.tsx`, `test/ui.test.tsx`, `test/app.test.tsx`.

**Spec:**

- Pin: React 18.x, `react-router-dom` 6.x, Vite 5.x, `@vitejs/plugin-react`, **Tailwind 3.4.x** (not v4), `postcss`, `autoprefixer`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `framer-motion`, `@radix-ui/react-tabs`, `@radix-ui/react-accordion`; dev: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@types/react`, `@types/react-dom`. Dependencies on `@sp/contracts` and `@sp/knowledge` (`workspace:*`). Vitest environment `jsdom`, setup file imports `@testing-library/jest-dom/vitest`.
- Do **not** run `npx shadcn` (it may install Tailwind v4). Write the components by hand in the shadcn style (class-variance-authority variants).
- Tokens in `index.css` as CSS variables: `--bg`, `--fg`, `--card`, `--muted`, `--primary`, `--border`, `--risk-low`, `--risk-moderate`, `--risk-high`; dark values under `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`; Tailwind colours read the variables. Font stack: Inter, then `"Noto Sans Bengali"`, then system sans. Load nothing from the network at build time; fonts via `<link>` to Google Fonts in `index.html` with the system fallback.
- Layout: top bar (name "SafePlate", language toggle), content, **bottom nav on mobile** with four links (Scan, History, Settings, About). Every interactive element is at least 44 px tall (`min-h-11`).
- `cn(...inputs)`: `twMerge(clsx(inputs))`.
- i18n: `I18nProvider({ lang, children })`, `useT()` returns `{ t, lang, setLang }`. `t(key, params?)` looks up `uiStrings[lang][key]`, then registered messages (`registerMessages(dict)`), else returns the **key** and `console.warn`s once per key. `{name}` placeholders are replaced from `params`. UI strings live in `src/i18n/ui-strings.ts` (English and Bangla for nav labels and buttons you add).

**Tests (write first):**

```ts
// test/cn.test.ts
import { describe, it, expect } from 'vitest';
import { cn } from '../src/lib/cn';
describe('cn', () => {
  it('merges and de-duplicates tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });
});
```

```tsx
// test/i18n.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider, useT, registerMessages } from '../src/i18n/i18n';
function Show({ k, p }: { k: string; p?: Record<string, string | number> }) {
  const { t } = useT();
  return <span>{t(k, p)}</span>;
}
describe('i18n', () => {
  it('returns the key and warns when missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <I18nProvider lang="en">
        <Show k="no.such.key" />
      </I18nProvider>,
    );
    expect(screen.getByText('no.such.key')).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
  });
  it('looks up registered messages per language and fills params', () => {
    registerMessages({ 'test.hello': { en: 'Hello {name}', bn: 'হ্যালো {name}' } });
    const { rerender } = render(
      <I18nProvider lang="en">
        <Show k="test.hello" p={{ name: 'Rima' }} />
      </I18nProvider>,
    );
    expect(screen.getByText('Hello Rima')).toBeInTheDocument();
    rerender(
      <I18nProvider lang="bn">
        <Show k="test.hello" p={{ name: 'Rima' }} />
      </I18nProvider>,
    );
    expect(screen.getByText('হ্যালো Rima')).toBeInTheDocument();
  });
});
```

```tsx
// test/ui.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../src/components/ui/button';
import { Badge } from '../src/components/ui/badge';
describe('ui components', () => {
  it('button has a 44px minimum height class', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('min-h-11');
  });
  it('badge renders its text', () => {
    render(<Badge>estimated</Badge>);
    expect(screen.getByText('estimated')).toBeInTheDocument();
  });
});
```

```tsx
// test/app.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/App';
describe('App shell', () => {
  it('shows four navigation links', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(4);
  });
});
```

**Done when:** `pnpm --filter @sp/web test`, `pnpm --filter @sp/web dev` runs (paste the URL in the report), `pnpm check` green. **Commit:** `feat(web): vite react tailwind scaffold with tokens, ui kit and i18n`

**Pitfalls:** `App` must not create its own router (tests wrap it in `MemoryRouter`; `main.tsx` supplies `BrowserRouter`). `useT()` must also work when no `I18nProvider` is mounted (default language `en`), because `app.test.tsx` renders `App` bare. Tailwind v3 syntax only (`@tailwind base; @tailwind components; @tailwind utilities;`).

---

## P1-C02 Profile store and onboarding

**Depends on:** P1-C01 · **Branch:** `c/P1-C02-profile-onboarding`

**Goal:** the health profile lives only on the device. Onboarding asks for language, optional conditions and allergies, and explicit consent; skipping is always possible.

**Files:** create `apps/web/src/state/profile-store.ts`, `useProfile.ts`, `src/pages/Onboarding.tsx`, `apps/web/test/profile-store.test.ts`, `onboarding.test.tsx`; edit `src/App.tsx` (route `/welcome`, redirect to it when no saved profile), `src/pages/Settings.tsx` (edit profile, **Delete my data** button).

**Spec:**

```ts
export const PROFILE_KEY = 'sp.profile.v1';
export interface ProfileStore {
  load(): UserProfile;
  save(p: UserProfile): void;
  clear(): void;
}
export class LocalProfileStore implements ProfileStore {
  constructor(storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>); /* ... */
}
```

- `load()` returns `EMPTY_PROFILE` for missing, corrupt or schema-invalid data (use `UserProfileSchema.safeParse`).
- Onboarding fields: language (en/bn), four condition checkboxes, ten allergen checkboxes, consent checkbox with the text key `onboarding.consent` (on-device only; can be deleted any time). **Save is disabled until consent is ticked when any condition or allergy is selected.** **Skip** saves only the language (`consentedAt: null`, empty lists).
- `consentedAt` is `new Date().toISOString()` from an injectable clock prop.

**Tests (write first):**

```ts
// profile-store.test.ts
import { describe, it, expect } from 'vitest';
import { EMPTY_PROFILE } from '@sp/contracts';
import { LocalProfileStore, PROFILE_KEY } from '../src/state/profile-store';
const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
};
describe('LocalProfileStore', () => {
  it('returns the empty profile when nothing is saved', () => {
    expect(new LocalProfileStore(mem()).load()).toEqual(EMPTY_PROFILE);
  });
  it('round-trips a profile', () => {
    const s = new LocalProfileStore(mem());
    const p = {
      ...EMPTY_PROFILE,
      conditions: ['diabetes' as const],
      consentedAt: '2026-10-25T00:00:00.000Z',
    };
    s.save(p);
    expect(s.load()).toEqual(p);
  });
  it('ignores corrupt or invalid data', () => {
    const st = mem();
    st.setItem(PROFILE_KEY, '{oops');
    expect(new LocalProfileStore(st).load()).toEqual(EMPTY_PROFILE);
    st.setItem(PROFILE_KEY, JSON.stringify({ conditions: ['flu'] }));
    expect(new LocalProfileStore(st).load()).toEqual(EMPTY_PROFILE);
  });
  it('clear removes the key', () => {
    const st = mem();
    const s = new LocalProfileStore(st);
    s.save(EMPTY_PROFILE);
    s.clear();
    expect(st.m.has(PROFILE_KEY)).toBe(false);
  });
});
```

```tsx
// onboarding.test.tsx  (use @testing-library/user-event; render inside I18nProvider)
// 1. Skip: click "Skip" -> store.load() has conditions [] and consentedAt null.
// 2. Tick "Diabetes" -> Save is disabled; tick consent -> Save enabled; click Save -> saved profile has conditions ['diabetes'] and a non-null consentedAt equal to the injected clock value.
// 3. With vi.spyOn(globalThis, 'fetch'): completing onboarding never calls fetch.
// 4. Settings "Delete my data" removes the stored key.
```

Write these four tests as real code following the pattern above (Onboarding takes props `store`, `now`, `onDone`).

**Done when:** green. **Commit:** `feat(web): on-device health profile and onboarding`

**Pitfalls:** never send or log the profile; no analytics. Label the consent text exactly with the message key so the nutritionist can review the wording.

---

## P1-C03 Image downscale, scan screen and API client

**Depends on:** P1-C01 · **Branch:** `c/P1-C03-scan-client`

**Goal:** pick or capture a photo, shrink it in the browser, choose context, call the API (or the mock) and get a typed result.

**Files:** create `apps/web/src/lib/downscale.ts`, `src/api/client.ts`, `src/pages/Scan.tsx` (replace placeholder), `apps/web/test/downscale.test.ts`, `client.test.ts`, `scan-page.test.tsx`.

**Spec:**

```ts
export function computeTargetSize(
  w: number,
  h: number,
  max = 1024,
): { width: number; height: number }; // keep aspect, never upscale
export async function downscaleToJpeg(
  file: File,
  opts?: { max?: number; quality?: number },
): Promise<{ base64: string; mimeType: 'image/jpeg' }>; // canvas; base64 without the data: prefix

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function scan(
  req: ScanRequest,
  opts?: { baseUrl?: string; fetchFn?: typeof fetch; timeoutMs?: number },
): Promise<ScanResult>;
export function mockScan(kind: 'dish' | 'label'): ScanResult; // returns a fixture, used when VITE_USE_MOCK === '1'
```

- `scan` validates the request with `ScanRequestSchema.parse` first, `POST`s to `${baseUrl}/api/scan` (`baseUrl` from `import.meta.env.VITE_API_BASE ?? ''`), parses the response with `ScanResultSchema`, or `ApiErrorSchema` for error statuses (throws `ApiClientError(code, message)`), and maps a timeout (default 30000 ms) or network failure to `ApiClientError('ai_unavailable', ...)`.
- Scan page: two tabs (Dish, Label); `<input type="file" accept="image/*" capture="environment">`; context chips for place and storage and a number input for hours (only for dish); an **Analyze** button disabled until a photo is chosen; loading and error states with a retry; success navigates to `/confirm` with `{ result, thumbDataUrl }` in router state (thumbnail at 160 px).

**Tests (write first):**

```ts
// downscale.test.ts
import { describe, it, expect } from 'vitest';
import { computeTargetSize } from '../src/lib/downscale';
describe('computeTargetSize', () => {
  it('shrinks the long side to max and keeps aspect', () => {
    expect(computeTargetSize(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 });
  });
  it('handles portrait', () => {
    expect(computeTargetSize(3000, 4000, 1024)).toEqual({ width: 768, height: 1024 });
  });
  it('never upscales', () => {
    expect(computeTargetSize(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });
});
```

```ts
// client.test.ts
import { describe, it, expect } from 'vitest';
import { scan, ApiClientError } from '../src/api/client';
const req = {
  kind: 'dish' as const,
  imageBase64: 'A'.repeat(200),
  mimeType: 'image/jpeg' as const,
  context: { place: 'home' as const, storage: 'unknown' as const, hoursSinceCooked: null },
};
const okBody = {
  kind: 'dish',
  candidates: [{ dishId: null, label: 'x', confidence: 0.2 }],
  observations: { spoilageSigns: [], imageQuality: 'good', notes: '' },
  provider: 'mock',
  cached: false,
};
describe('scan client', () => {
  it('posts to /api/scan and parses the result', async () => {
    let url = '';
    const fetchFn = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify(okBody));
    }) as unknown as typeof fetch;
    const r = await scan(req, { baseUrl: 'http://api', fetchFn });
    expect(url).toBe('http://api/api/scan');
    expect(r.kind).toBe('dish');
  });
  it('throws ApiClientError with the server code', async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'slow down' } }), {
        status: 429,
      })) as unknown as typeof fetch;
    await expect(scan(req, { baseUrl: '', fetchFn })).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });
  it('maps network failure to ai_unavailable', async () => {
    const fetchFn = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    await expect(scan(req, { baseUrl: '', fetchFn })).rejects.toBeInstanceOf(ApiClientError);
  });
  it('refuses a request that carries extra fields such as a profile', async () => {
    const bad = { ...req, profile: { conditions: ['diabetes'] } } as unknown as typeof req;
    await expect(
      scan(bad, {
        baseUrl: '',
        fetchFn: (async () => new Response('{}')) as unknown as typeof fetch,
      }),
    ).rejects.toThrow();
  });
});
```

`scan-page.test.tsx` (write as real code): Analyze is disabled before a file is chosen; with a mocked `downscaleToJpeg` and a mocked `scan` that rejects with `ApiClientError('ai_unavailable', 'x')`, the page shows the error message key text and a Retry button.

**Done when:** green. **Commit:** `feat(web): image downscale, scan page and typed api client`

---

## P1-C04 Risk gauge and evidence components

**Depends on:** P1-C01 · **Branch:** `c/P1-C04-result-components`

**Goal:** the visual building blocks of the Safety card, built against fixtures so they are ready when real data arrives.

**Files:** create `apps/web/src/components/RiskGauge.tsx`, `EvidenceList.tsx`, `NoticeBanner.tsx`, `StatusBadge.tsx`, `apps/web/test/result-components.test.tsx`.

**Spec:**

- `RiskGauge({ score, level })`: an SVG semicircle gauge from 0 to 100, colour from `--risk-*`, the score as large text, the level as a **word** (`safety.level.low|moderate|high` through `t`) and an **icon** (lucide `ShieldCheck`, `AlertTriangle`, `ShieldAlert`), and `role="img"` with `aria-label` containing the score and level. Animate the arc with Framer Motion unless `prefers-reduced-motion`.
- `EvidenceList({ signals, rulesStatus })`: an accordion titled "Why this score?"; each signal shows `t(labelKey)`, `+points`, the `evidence` text and, when `sourceRef` exists, a "Source" chip. Shows a `StatusBadge` "draft rules" when `rulesStatus === 'draft'`. Empty list shows `safety.no_signals`.
- `NoticeBanner({ noticeKeys })`: renders each `t(key)` in a bordered callout with an info icon. **Never collapsible.**
- `StatusBadge({ kind })`: `kind` is `estimated` or `draft`; text through `t('badge.estimated')` and `t('badge.draft')`.

**Tests (write first)** (register messages in the test with `registerMessages`):

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider, registerMessages } from '../src/i18n/i18n';
import { RiskGauge } from '../src/components/RiskGauge';
import { EvidenceList } from '../src/components/EvidenceList';
import { NoticeBanner } from '../src/components/NoticeBanner';

registerMessages({
  'safety.level.high': { en: 'High', bn: 'উচ্চ' },
  'safety.level.low': { en: 'Low', bn: 'কম' },
  'safety.no_signals': { en: 'No warning signs found', bn: 'কোনো সতর্কতা নেই' },
  'safety.mold': { en: 'Mold visible', bn: 'ছাতা' },
  'notice.chemical_limit': { en: 'This check cannot detect invisible chemicals.', bn: '...' },
  'badge.draft': { en: 'draft rules', bn: 'খসড়া' },
});
const wrap = (ui: JSX.Element) => render(<I18nProvider lang="en">{ui}</I18nProvider>);

describe('result components', () => {
  it('gauge shows the score, the level word and an accessible label', () => {
    wrap(<RiskGauge score={72} level="high" />);
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('72');
  });
  it('evidence list shows evidence, points, and a draft badge', () => {
    wrap(
      <EvidenceList
        rulesStatus="draft"
        signals={[
          {
            ruleId: 'm',
            labelKey: 'safety.mold',
            points: 40,
            evidence: 'Photo shows: visible_mold',
            sourceRef: 'S1',
          },
        ]}
      />,
    );
    expect(screen.getByText(/Photo shows: visible_mold/)).toBeInTheDocument();
    expect(screen.getByText('+40')).toBeInTheDocument();
    expect(screen.getByText('draft rules')).toBeInTheDocument();
  });
  it('evidence list says so when there are no signals', () => {
    wrap(<EvidenceList rulesStatus="approved" signals={[]} />);
    expect(screen.getByText('No warning signs found')).toBeInTheDocument();
  });
  it('notice banner renders every notice', () => {
    wrap(<NoticeBanner noticeKeys={['notice.chemical_limit']} />);
    expect(screen.getByText(/cannot detect invisible chemicals/)).toBeInTheDocument();
  });
});
```

(The accordion content must be rendered in the DOM even when collapsed or the test opens it first with `userEvent.click`; choose one and keep the test consistent.)

**Done when:** green. **Commit:** `feat(web): risk gauge, evidence list, notice banner, status badge`

---

# TRACK D: Data (`packages/knowledge`, `tools`)

## P1-D01 Normalize the data

**Depends on:** P0-X04 · **Blocks:** D02, D03, D04, all Phase 2 data cards · **Branch:** `d/P1-D01-normalize`

**Goal:** clean, consistent copies of the data (never touching the source files): one allergen vocabulary, a cooking class per dish, and a slim file for the browser.

**Files:** create `packages/knowledge/src/normalize.ts`, `packages/knowledge/test/normalize.test.ts`, `tools/src/normalize-data.ts`; edit `packages/knowledge/src/index.ts` (add `getDishes()`, `getIngredients()` reading `data/normalized/`), `packages/knowledge/package.json`, `tools/package.json` (script `normalize`); generated and committed: `packages/knowledge/data/normalized/dishes.json`, `ingredients.json`, `packages/knowledge/data/runtime/runtime.json`, `packages/knowledge/data/proposals/cooking-classes.json`.
**Contract:** uses `DishSchema` and `NormalizedDishesFileSchema` from `@sp/contracts` (added in P0-X03).

**Spec:**

```ts
import type { Allergen, CookingClass, RawDish, Dish } from '@sp/contracts';
/** Maps a raw allergen string to the canonical vocabulary, or null if unknown. */
export function normalizeAllergen(raw: string): Allergen | null;
/** Returns the cooking class for a free-text cooking method (ordered rules, first match wins). */
export function classifyCooking(method: string): CookingClass;
/** Returns the dish with canonical allergens (deduplicated), validated safety tags and a cooking class. Throws with the dish id on an unknown allergen or tag. */
export function normalizeDish(d: RawDish): Dish;
```

`normalizeAllergen`: `dairy` and `milk` give `milk`; `wheat_gluten`, `gluten`, `wheat` give `wheat_gluten`; `tree_nuts`, `tree nuts` give `tree_nuts`; `crustacean_shellfish`, `shellfish`, `crustacean` give `crustacean_shellfish`; `peanut`, `peanuts` give `peanuts`; `egg`, `fish`, `soy`, `sesame`, `mustard` map to themselves; case-insensitive; anything else `null`.

`classifyCooking` ordered rules (lowercase the text): (1) contains `steam` → `steamed`; (2) contains `milk` and (`sweetened` or `reduced`) → `sweet_milk_based`; (3) contains `ferment` or `soaked` → `fermented`; (4) contains `deep` and not `shallow` → `deep_fried`; (5) contains `fried`, `fry` or `sauté` → `shallow_fried`; (6) contains `braised`, `simmer`, `curry`, `gravy`, `slow-cooked`, `stew` or `layered` → `braised_or_curry`; (7) contains `boiled` → `boiled_or_simmered`; (8) contains `baked` or `roasted` → `baked_or_roasted`; (9) contains `mashed` → `mashed_or_raw`; else `mixed_or_other`.

The script writes `cooking-classes.json` (dish id, method text, class) **for the nutritionist's quick review**, and `runtime.json` = dishes (`id, name_en, name_bn, aliases, category, serving_description, serving_weight_g, ingredients, allergens, safety_tags, cooking_class, nutrition_basis, lab_values_per_serving.values`) and ingredients (`id, name_en, name_bn` plus the 8 nutrients and `match_quality`) with no notes or provenance.

**Tests (write first):**

```ts
import { describe, it, expect } from 'vitest';
import { makeDish } from '@sp/contracts/testing';
import { normalizeAllergen, classifyCooking, normalizeDish } from '../src/normalize';
import { getRawDishes, getDishes } from '../src';

describe('normalizeAllergen', () => {
  it.each([
    ['dairy', 'milk'],
    ['milk', 'milk'],
    ['Wheat_Gluten', 'wheat_gluten'],
    ['tree_nuts', 'tree_nuts'],
    ['crustacean_shellfish', 'crustacean_shellfish'],
    ['mustard', 'mustard'],
  ] as const)('%s -> %s', (raw, out) => {
    expect(normalizeAllergen(raw)).toBe(out);
  });
  it('returns null for unknown', () => {
    expect(normalizeAllergen('pollen')).toBeNull();
  });
});
describe('classifyCooking', () => {
  it.each([
    ['steamed in cloth over boiling water', 'steamed'],
    ['milk reduced, sweetened and fermented', 'sweet_milk_based'],
    ['soaked/fermented cooked rice served with fried fish', 'fermented'],
    ['shells deep-fried, then filled at serving', 'deep_fried'],
    ['shallow-fried', 'shallow_fried'],
    ['boiled and mashed', 'boiled_or_simmered'],
    ['roasted, peeled and mashed', 'baked_or_roasted'],
    ['something unusual', 'mixed_or_other'],
  ] as const)('%s -> %s', (text, cls) => {
    expect(classifyCooking(text)).toBe(cls);
  });
});
describe('normalizeDish', () => {
  it('deduplicates dairy and milk', () => {
    expect(normalizeDish(makeDish({ id: 'd', allergens: ['dairy', 'milk'] })).allergens).toEqual([
      'milk',
    ]);
  });
  it('throws with the dish id on an unknown allergen', () => {
    expect(() => normalizeDish(makeDish({ id: 'dish-x', allergens: ['pollen'] }))).toThrow(
      'dish-x',
    );
  });
  it('never changes ingredient lines or serving weight', () => {
    const raw = getRawDishes();
    const norm = getDishes();
    expect(norm).toHaveLength(raw.length);
    raw.forEach((r, i) => {
      expect(norm[i]?.ingredients).toEqual(r.ingredients);
      expect(norm[i]?.serving_weight_g).toBe(r.serving_weight_g);
    });
  });
  it('gives every real dish a cooking class', () => {
    for (const d of getDishes()) expect(d.cooking_class).toBeTruthy();
  });
});
```

**Done when:** green; run `pnpm --filter @sp/tools normalize` and commit the generated files; report the size of `runtime.json` (target below 150 KB). **Commit:** `feat(knowledge): normalized data, cooking classes, runtime export`

**Pitfalls:** never edit `data/source/`. Print the `cooking-classes.json` table in the report so a human can eyeball it.

---

## P1-D02 FCTB match proposals

**Depends on:** P1-D01, P0-D01 (the FCTB PDF in `data/raw/`) · **Branch:** `d/P1-D02-fctb-proposals`

**Goal:** for ingredients with missing values, find candidate rows in the Food Composition Table for Bangladesh and write **proposals** for a human to approve. The agent never applies them.

**Files:** create `tools/src/fctb-lib.ts`, `tools/src/fctb-match.ts`, `tools/test/fctb-lib.test.ts`; edit `tools/package.json` (script `fctb-match`; add a PDF text library such as `pdfjs-dist`, pinned; if text extraction fails or the tables come out garbled, **stop and report**, so a human can supply the electronic table instead). Generated: `packages/knowledge/data/proposals/fctb-matches.json`.

**Spec (pure functions in `fctb-lib.ts`):**

```ts
export interface FctbRow {
  foodCode: string;
  name: string;
  page: number;
  table: string;
  values: Partial<Record<NutrientKey, number>>;
  rowText: string;
}
/** Lowercases, removes punctuation and stop words ("raw", "fresh"), returns tokens. */
export function tokens(name: string): string[];
/** Returns 0..1 token-overlap score between an ingredient query and a row name. */
export function scoreMatch(query: string, rowName: string): number;
/** Returns up to `limit` rows with score >= minScore, best first. */
export function candidatesFor(
  query: string,
  rows: FctbRow[],
  limit?: number,
  minScore?: number,
): Array<FctbRow & { score: number }>;
/** Compares parsed rows with ingredients that already have a known food_code; returns mismatching ingredient ids. */
export function calibrate(rows: FctbRow[], known: Ingredient[]): string[];
```

`fctb-match.ts` does: extract page text → parse rows whose first field matches `\d{2}_\d{4}` into `FctbRow` for the **proximate composition** and **mineral (sodium)** tables → **run `calibrate` first**: for every ingredient that already carries a `food_code` in `nutrient_sources`, the parsed values must equal the stored ones. **If there is any mismatch, stop and report** (the column mapping is wrong; never continue). Then, for each ingredient with at least one null nutrient, write `{ ingredientId, candidates: [{ foodCode, rowName, page, table, values, rowText, score }], approvedFoodCode: null }` (top 5). Every candidate keeps the raw `rowText` so a human can check it against the PDF.

**Tests (write first)** (synthetic rows only):

```ts
import { describe, it, expect } from 'vitest';
import { makeIngredient } from '@sp/contracts/testing';
import { tokens, scoreMatch, candidatesFor, calibrate, type FctbRow } from '../src/fctb-lib';
const row = (foodCode: string, name: string, values: FctbRow['values'] = {}): FctbRow => ({
  foodCode,
  name,
  page: 33,
  table: 'Proximate composition',
  values,
  rowText: `${foodCode} ${name}`,
});
describe('fctb-lib', () => {
  it('tokenizes without stop words', () => {
    expect(tokens('Rice, white, RAW')).toEqual(['rice', 'white']);
  });
  it('scores identical names 1 and unrelated names 0', () => {
    expect(scoreMatch('hilsa', 'Hilsa')).toBe(1);
    expect(scoreMatch('hilsa', 'Wheat flour')).toBe(0);
  });
  it('returns the best candidates first and respects limit and minScore', () => {
    const rows = [row('1', 'Hilsa fish'), row('2', 'Hilsa'), row('3', 'Wheat')];
    const c = candidatesFor('hilsa', rows, 5, 0.3);
    expect(c.map((x) => x.foodCode)).toEqual(['2', '1']);
    expect(candidatesFor('hilsa', rows, 1, 0.3)).toHaveLength(1);
  });
  it('calibrate returns ids whose stored values differ from the parsed row', () => {
    const known = [
      makeIngredient({
        id: 'rice',
        energy_kcal: 345,
        nutrient_sources: { energy_kcal: { source_id: 'FCTB-2013', food_code: '01_0025' } },
      }),
    ];
    expect(calibrate([row('01_0025', 'Rice', { energy_kcal: 345 })], known)).toEqual([]);
    expect(calibrate([row('01_0025', 'Rice', { energy_kcal: 999 })], known)).toEqual(['rice']);
  });
});
```

**Done when:** green; run `pnpm --filter @sp/tools fctb-match`; paste in the report: calibration result (how many known ingredients checked, mismatches), number of ingredients with at least one candidate. **Commit:** `feat(tools): fctb match proposals with calibration`

**Pitfalls:** never auto-apply; never write outside `data/proposals/`; `calibrate` must run on real data and be reported.

---

## P1-D03 USDA gap proposals

**Depends on:** P1-D01, P0-D01 (USDA CSVs in `data/raw/usda/`) · **Branch:** `d/P1-D03-usda-proposals`

**Goal:** propose USDA FoodData Central values **only for fields still null** (saturated fat, sugars, sodium, and ingredients with no FCTB match), flagged as proxy matches.

**Files:** create `tools/src/usda-lib.ts`, `tools/src/usda-match.ts`, `tools/test/usda-lib.test.ts`; edit `tools/package.json` (script `usda-match`; a CSV parser such as `csv-parse`, pinned). Generated: `packages/knowledge/data/proposals/usda-matches.json`.

**Spec:**

```ts
export const USDA_NUTRIENT_NBR = {
  energy_kcal: '208',
  protein_g: '203',
  fat_g: '204',
  carbs_g: '205',
  sugars_g: '269',
  fibre_g: '291',
  sodium_mg: '307',
  sat_fat_g: '606',
} as const;
export interface UsdaFood {
  fdcId: number;
  description: string;
  values: Partial<Record<NutrientKey, number>>;
}
/** Parses the CSV texts (food, nutrient, food_nutrient) into foods. Throws if a nutrient number's name does not look right. */
export function parseUsda(
  foodCsv: string,
  nutrientCsv: string,
  foodNutrientCsv: string,
): UsdaFood[];
/** Returns up to `limit` foods whose description matches the query, preferring raw entries, best first. */
export function searchFoods(
  query: string,
  foods: UsdaFood[],
  limit?: number,
): Array<UsdaFood & { score: number }>;
/** Returns only the null fields of `ing` that `food` can fill; never overwrites a non-null value. */
export function fillablePatch(ing: Ingredient, food: UsdaFood): Partial<NutrientValues>;
```

`parseUsda` verifies that nutrient number `208` has a name containing "energy", `307` "sodium", `606` "saturated", `269` "sugars", `291` "fiber"; otherwise it throws (the column or number mapping changed, so stop and report). Use the **SR Legacy** and/or **Foundation Foods** CSVs found in `data/raw/usda/`.

`usda-match.ts` writes, for each ingredient with any null nutrient, `{ ingredientId, candidates: [{ fdcId, description, patch, score }] (top 5, or empty), matchQuality: 'proxy', approvedFdcId: null }`. Ingredients with no sensible candidate get an empty list (for example a local fish): do not force a match.

**Tests (write first)** (tiny synthetic CSV strings):

```ts
import { describe, it, expect } from 'vitest';
import { makeIngredient } from '@sp/contracts/testing';
import { parseUsda, searchFoods, fillablePatch } from '../src/usda-lib';
const food =
  'fdc_id,data_type,description\n1,sr_legacy_food,"Turmeric, ground"\n2,sr_legacy_food,"Fish, herring, raw"';
const nutrient =
  'id,name,unit_name,nutrient_nbr\n10,Energy,KCAL,208\n11,"Sodium, Na",MG,307\n12,"Fatty acids, total saturated",G,606\n13,"Sugars, total including NLEA",G,269\n14,"Fiber, total dietary",G,291\n15,Protein,G,203\n16,"Total lipid (fat)",G,204\n17,"Carbohydrate, by difference",G,205';
const fn = 'id,fdc_id,nutrient_id,amount\n1,1,10,312\n2,1,11,38\n3,2,10,158\n4,2,12,3.1';
describe('usda-lib', () => {
  const foods = parseUsda(food, nutrient, fn);
  it('parses foods with their nutrient values', () => {
    expect(foods).toHaveLength(2);
    expect(foods.find((f) => f.fdcId === 1)?.values).toMatchObject({
      energy_kcal: 312,
      sodium_mg: 38,
    });
  });
  it('throws when a nutrient number has the wrong name', () => {
    expect(() => parseUsda(food, nutrient.replace('Energy', 'Water'), fn)).toThrow();
  });
  it('prefers matching descriptions', () => {
    expect(searchFoods('turmeric', foods)[0]?.fdcId).toBe(1);
  });
  it('fills only null fields and never overwrites', () => {
    const ing = makeIngredient({ id: 'turmeric', energy_kcal: 354 });
    const patch = fillablePatch(ing, foods[0]!);
    expect(patch.energy_kcal).toBeUndefined();
    expect(patch.sodium_mg).toBe(38);
  });
});
```

**Done when:** green; run the script; report counts (ingredients with candidates, with none). **Commit:** `feat(tools): usda gap proposals, proxy flagged`

---

## P1-DH01 [HUMAN] Approve proposals (track D, about 2 hours; a nutritionist if available)

- [ ] Open `data/proposals/fctb-matches.json` and `usda-matches.json`.
- [ ] Sort your attention by **impact**: the ingredients with the most grams across dishes first (run the coverage report from P1-D04 once available, or check `ingredients.json` usage by eye).
- [ ] For each ingredient set `approvedFoodCode` (FCTB) or `approvedFdcId` (USDA), or leave `null` to reject.
- [ ] Rules: prefer FCTB over USDA. Approve a USDA match only if the food is genuinely the same thing (for example turmeric powder to turmeric powder). Reject doubtful matches. Check `rowText` against the PDF for ten random FCTB rows.
- [ ] Spices with tiny gram amounts matter little: do not spend time on them.
- [ ] Commit the edited proposal files on a branch `d/P1-DH01-approvals` and open a PR (no agent needed).

Done when: every high-impact ingredient has a decision.

---

## P1-D04 Apply approved matches and coverage report

**Depends on:** P1-DH01, P1-A01 · **Branch:** `d/P1-D04-apply-coverage`

**Goal:** merge only approved proposals into the normalized ingredients, with provenance, and print how well each dish is covered.

**Files:** create `tools/src/apply-lib.ts`, `tools/src/apply-approved.ts`, `tools/src/coverage-report.ts`, `tools/test/apply-lib.test.ts`; edit `tools/package.json` (scripts `apply-approved`, `coverage`), `tools/package.json` dependency on `@sp/engine` and `@sp/knowledge`. Generated: updated `packages/knowledge/data/normalized/ingredients.json`, `packages/knowledge/data/runtime/runtime.json`.

**Spec:**

```ts
export interface FctbApproval {
  ingredientId: string;
  foodCode: string;
  table: string;
  page: number;
  values: Partial<NutrientValues>;
}
export interface UsdaApproval {
  ingredientId: string;
  fdcId: number;
  description: string;
  patch: Partial<NutrientValues>;
}
/** Applies approvals to ingredients; only fills null fields; adds nutrient_sources, match_quality and review_status. Pure; returns new objects. */
export function applyApprovals(
  ingredients: Ingredient[],
  fctb: FctbApproval[],
  usda: UsdaApproval[],
): { ingredients: Ingredient[]; applied: string[] };
```

- FCTB approvals set `nutrient_sources[n] = { source_id: 'FCTB-2013', table, pdf_page, food_code }`; USDA approvals set `{ source_id: 'USDA-FDC', fdc_id, description }` and `match_quality: 'proxy'`. Set `review_status: 'approved'` on any ingredient changed. **Never overwrite a non-null value.** Re-running must give identical output (idempotent).
- `coverage-report.ts` uses `computeNutrition` from `@sp/engine` and prints a table: dish, coverage of energy, protein, fat, carbs, sodium, sat fat, sugars, and whether `energy_kcal` passes the gate (`>= 0.8`). It also prints the list of ingredients that still have no energy value, sorted by total grams across dishes.

**Tests (write first):**

```ts
import { describe, it, expect } from 'vitest';
import { makeIngredient } from '@sp/contracts/testing';
import { applyApprovals } from '../src/apply-lib';
const hilsa = makeIngredient({ id: 'hilsa' });
const turmeric = makeIngredient({ id: 'turmeric', energy_kcal: 354 });
describe('applyApprovals', () => {
  it('fills null fields from FCTB with provenance', () => {
    const r = applyApprovals(
      [hilsa],
      [
        {
          ingredientId: 'hilsa',
          foodCode: '08_0001',
          table: 'Proximate composition',
          page: 40,
          values: { energy_kcal: 200, protein_g: 20 },
        },
      ],
      [],
    );
    expect(r.ingredients[0]).toMatchObject({
      energy_kcal: 200,
      protein_g: 20,
      review_status: 'approved',
    });
    expect(r.ingredients[0]?.nutrient_sources.energy_kcal).toMatchObject({
      source_id: 'FCTB-2013',
      food_code: '08_0001',
      pdf_page: 40,
    });
    expect(r.applied).toEqual(['hilsa']);
  });
  it('never overwrites a non-null value', () => {
    const r = applyApprovals(
      [turmeric],
      [],
      [
        {
          ingredientId: 'turmeric',
          fdcId: 7,
          description: 'Turmeric',
          patch: { energy_kcal: 1, sodium_mg: 38 },
        },
      ],
    );
    expect(r.ingredients[0]?.energy_kcal).toBe(354);
    expect(r.ingredients[0]?.sodium_mg).toBe(38);
    expect(r.ingredients[0]?.match_quality).toBe('proxy');
  });
  it('is idempotent and does not mutate its input', () => {
    const input = [hilsa];
    const approvals = [
      { ingredientId: 'hilsa', foodCode: 'x', table: 't', page: 1, values: { energy_kcal: 200 } },
    ];
    const once = applyApprovals(input, approvals, []);
    expect(applyApprovals(once.ingredients, approvals, []).ingredients).toEqual(once.ingredients);
    expect(input[0]?.energy_kcal).toBeNull();
  });
  it('ignores approvals for unknown ingredients', () => {
    expect(
      applyApprovals(
        [hilsa],
        [{ ingredientId: 'nope', foodCode: 'x', table: 't', page: 1, values: { energy_kcal: 1 } }],
        [],
      ).applied,
    ).toEqual([]);
  });
});
```

**Done when:** green; run `apply-approved` then `coverage`; **paste the coverage table in the report**. **Commit:** `feat(tools): apply approved matches with provenance and coverage report`

**Pitfalls:** only entries with a non-null approval are applied; the script exits with an error if a proposal file is missing. This card produces the numbers that decide the demo dish list (P2-D06).
