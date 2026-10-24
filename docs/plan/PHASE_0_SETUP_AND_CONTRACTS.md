# PHASE 0: Setup and contracts (Fri Oct 23)

**Goal:** a green monorepo, shared schemas that validate the real data, mock data so nobody waits, and the raw data sources fetched (or a clear note of what a human must download).

**Exit criteria:** all P0 cards merged; `pnpm check` green on `main`; tag `phase-0-done`.

**Order:** P0-H01 and P0-H02 (humans, start immediately) → P0-X01 → P0-X02 → P0-X03 → P0-X04. P0-D01 is independent and can run in parallel with X01.

---

## P0-H01 [HUMAN] Repo, accounts, keys, team (repo owner, about 1 hour)

Checklist (no agent):

- [ ] Create the GitHub repo `safeplate`. **Prefer public** (full branch protection and free Actions). If private, say so in the team chat and rely on the "no direct pushes to `main`" rule.
- [ ] Unzip this kit into the repo root. `git init`, first commit "chore: add agent kit", push to `main`.
- [ ] Add the other three teammates as collaborators.
- [ ] If public: enable branch protection on `main` (require a pull request and passing status checks once P0-X01 adds CI).
- [ ] Fill in `docs/TEAM.md` (names, track letters, who reviews whom).
- [ ] Create accounts: **Cloudflare** (free), an **AI provider API key** (Gemini free tier; check Google AI Studio for the current limits and model names), and make sure each person can push to GitHub from their terminal.
- [ ] Keys go only in a local `.env` file (gitignored) and later in Cloudflare secrets. **Never paste a key into an agent chat or a commit.**
- [ ] Install on every machine: Node 20 or 22, pnpm, git.

Done when: all four people can `git clone` and `git push` a test branch.

## P0-H02 [HUMAN] Data files in place (track D, 10 minutes)

- [ ] Confirm `packages/knowledge/data/source/dishes.json` and `ingredients.json` are present exactly as received (they ship in this kit). **Never edit them.**
- [ ] Optionally download manually now (saves time later): the Food Composition Table for Bangladesh PDF as `data/raw/fctb-2013.pdf`, and the USDA FoodData Central CSV download from the official download page as a folder `data/raw/usda/`. `data/raw/` is gitignored.

Done when: the two JSON files exist and `data/raw/` has whatever you could download (the agent card P0-D01 handles the rest).

---

## P0-X01 Scaffold the monorepo

**Track:** shared · **Depends on:** nothing · **Blocks:** everything · **Branch:** `x/P0-X01-scaffold`

**Goal:** a pnpm workspace with TypeScript strict, ESLint, Prettier, Vitest, CI and four empty packages, where `pnpm check` passes.

**Read:** `AGENTS.md` sections 4, 5, 6.

**Files (create):**
- `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `.env.example`, `.nvmrc`
- `.github/workflows/ci.yml`, `.github/CODEOWNERS`
- For each of `packages/contracts`, `packages/knowledge`, `packages/engine`, `packages/ai`, `tools`: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `test/smoke.test.ts`
- `packages/contracts/test/workspace.test.ts`

**Do not touch:** `AGENTS.md`, `docs/`, `packages/knowledge/data/`.

**Spec:**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
  - "tools"
```

Root `package.json` (set `packageManager` to the output of `pnpm --version`, for example `pnpm@9.15.0`):
```json
{
  "name": "safeplate",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@<your installed version>",
  "engines": { "node": ">=20" },
  "scripts": {
    "typecheck": "pnpm -r --if-present typecheck",
    "lint": "eslint .",
    "test": "pnpm -r --if-present test",
    "check": "pnpm typecheck && pnpm lint && pnpm test",
    "format": "prettier --write ."
  },
  "devDependencies": {}
}
```
Dev dependencies to add at the root (pin exact versions you install): `typescript` (5.x), `vitest` (latest stable 2.x or 3.x), `eslint` (9.x), `@eslint/js`, `typescript-eslint`, `prettier`, `tsx`, `@types/node` (20.x).

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  }
}
```

Each package, for example `packages/contracts/package.json`:
```json
{
  "name": "@sp/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "typecheck": "tsc -p tsconfig.json", "test": "vitest run" }
}
```
Use `@sp/knowledge`, `@sp/engine`, `@sp/ai`, `@sp/tools` for the others. `packages/contracts` also exports `./testing` later (card P0-X03), so use an `exports` map there: `{ ".": "./src/index.ts", "./testing": "./src/testing.ts" }` (keep `main` and `types` too).

Each `tsconfig.json`: `{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }` (for `tools`: `"../tsconfig.base.json"`).

Each `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
```

`eslint.config.js`:
```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'data/raw/**', '**/.wrangler/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
    },
  },
);
```

`.gitignore`: `node_modules`, `dist`, `.env`, `.env.*` (but not `.env.example`), `data/raw/`, `.wrangler`, `.dev.vars`, `coverage`, `*.log`, `.DS_Store`.

`.env.example` (values empty):
```
AI_PROVIDER=mock
GEMINI_API_KEY=
GEMINI_MODEL=
ALLOWED_ORIGIN=http://localhost:5173
```

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm check
```

`.github/CODEOWNERS` (replace handles in P0-H01 or later):
```
packages/engine/ @TEAM-A
packages/ai/ @TEAM-B
apps/api/ @TEAM-B
apps/web/ @TEAM-C
packages/knowledge/ @TEAM-D
tools/ @TEAM-D
packages/contracts/ @TEAM-A @TEAM-B @TEAM-C @TEAM-D
```

**Tests (write first):**

`packages/contracts/test/workspace.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const rootPkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8'),
);

describe('workspace', () => {
  it('has a check script that runs typecheck, lint and tests', () => {
    expect(rootPkg.scripts.check).toContain('typecheck');
    expect(rootPkg.scripts.check).toContain('lint');
    expect(rootPkg.scripts.check).toContain('test');
  });
  it('is private and pins the package manager', () => {
    expect(rootPkg.private).toBe(true);
    expect(rootPkg.packageManager).toMatch(/^pnpm@/);
  });
});
```
Each package's `test/smoke.test.ts`: `import { it, expect } from 'vitest'; it('runs', () => { expect(1 + 1).toBe(2); });`
Each `src/index.ts`: `export {};`

**Done when:** `pnpm install && pnpm check` is green locally.

**Commit:** `chore(repo): scaffold pnpm monorepo with ts, eslint, vitest, ci`

**Pitfalls:** Do not create `apps/api` or `apps/web` (later cards do). Do not use `^` in versions. If `tsc` complains that a package has no inputs, keep `export {};` in `src/index.ts`. After merging, the repo owner enables the CI status check in branch protection.

---

## P0-X02 Contracts: knowledge schemas that validate the real data

**Track:** shared · **Depends on:** P0-X01 · **Blocks:** P0-X03, P0-X04 · **Branch:** `x/P0-X02-knowledge-schemas`

**Goal:** Zod schemas that accept the team's real `dishes.json` and `ingredients.json` **unchanged**, plus a function that finds dangling ingredient references.

**Read:** `docs/TECH_DESIGN.md` sections 3 and 11; both files in `packages/knowledge/data/source/` (skim the first dish and first ingredient).

**Files:**
- create `packages/contracts/src/knowledge.ts`
- edit `packages/contracts/src/index.ts` (export everything from `./knowledge`)
- create `packages/contracts/test/knowledge.test.ts`
- edit `packages/contracts/package.json` (add dependency `zod` pinned to the latest **3.x** release; do not use Zod 4)

**Spec** (`knowledge.ts`; implement exactly):
```ts
import { z } from 'zod';

export const NUTRIENT_KEYS = [
  'energy_kcal', 'protein_g', 'fat_g', 'sat_fat_g', 'carbs_g', 'sugars_g', 'fibre_g', 'sodium_mg',
] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export const NutrientKeySchema = z.enum(NUTRIENT_KEYS);

export const NutrientValuesSchema = z.object({
  energy_kcal: z.number().nullable(),
  protein_g: z.number().nullable(),
  fat_g: z.number().nullable(),
  sat_fat_g: z.number().nullable(),
  carbs_g: z.number().nullable(),
  sugars_g: z.number().nullable(),
  fibre_g: z.number().nullable(),
  sodium_mg: z.number().nullable(),
});
export type NutrientValues = z.infer<typeof NutrientValuesSchema>;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const provenance = z.object({ source_id: z.string() }).passthrough();

export const IngredientSchema = NutrientValuesSchema.extend({
  id: slug,
  name_en: z.string().min(1),
  name_bn: z.string(),
  basis: z.literal('per_100_g_raw_ingredient'),
  source: z.array(provenance),
  nutrient_sources: z.record(provenance),
  notes: z.string().optional(),
  match_quality: z.enum(['direct', 'proxy']).optional(),
  review_status: z.enum(['draft', 'approved']).optional(),
}).passthrough();
export type Ingredient = z.infer<typeof IngredientSchema>;

export const RawDishSchema = z.object({
  id: slug,
  name_en: z.string().min(1),
  name_bn: z.string(),
  aliases: z.array(z.string()),
  category: z.string(),
  serving_description: z.string(),
  serving_weight_g: z.number().positive(),
  serving_weight_basis: z.literal('ESTIMATE'),
  ingredients: z.array(z.object({
    ingredient_id: slug,
    grams_raw: z.number().positive(),
    quantity_basis: z.enum(['ESTIMATE', 'SOURCE']),
  })).min(1),
  cooking_method: z.string(),
  allergens: z.array(z.string()),
  safety_tags: z.array(z.string()),
  nutrition_basis: z.enum(['lab_analyzed', 'calculated', 'unavailable']),
  lab_values_per_serving: z.object({
    value_basis: z.string(),
    values: NutrientValuesSchema,
  }).passthrough().nullable(),
  sources: z.array(z.object({ title: z.string() }).passthrough()),
  confidence: z.enum(['low', 'medium', 'high']),
  needs_expert_review: z.boolean(),
  notes: z.array(z.string()),
  batch_number: z.number().int(),
}).passthrough();
export type RawDish = z.infer<typeof RawDishSchema>;

export const RawDishesFileSchema = z.object({
  metadata: z.record(z.unknown()),
  dishes: z.array(RawDishSchema).min(1),
});
export const RawIngredientsFileSchema = z.object({
  metadata: z.record(z.unknown()),
  ingredients: z.array(IngredientSchema).min(1),
});

/** Returns one message per dish ingredient line whose ingredient_id is not in the ingredient list. */
export function findDanglingRefs(dishes: RawDish[], ingredients: Ingredient[]): string[] {
  const known = new Set(ingredients.map((i) => i.id));
  const errors: string[] = [];
  for (const d of dishes) {
    for (const line of d.ingredients) {
      if (!known.has(line.ingredient_id)) errors.push(`${d.id}: unknown ingredient ${line.ingredient_id}`);
    }
  }
  return errors;
}
```

**Tests (write first)** `packages/contracts/test/knowledge.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  NUTRIENT_KEYS, RawDishesFileSchema, RawIngredientsFileSchema, RawDishSchema, findDanglingRefs,
} from '../src/knowledge';

const load = (name: string) =>
  JSON.parse(readFileSync(
    fileURLToPath(new URL(`../../knowledge/data/source/${name}`, import.meta.url)), 'utf8'));

describe('real data files', () => {
  const dishesFile = RawDishesFileSchema.parse(load('dishes.json'));
  const ingredientsFile = RawIngredientsFileSchema.parse(load('ingredients.json'));

  it('contains 30 dishes and 56 ingredients', () => {
    expect(dishesFile.dishes).toHaveLength(30);
    expect(ingredientsFile.ingredients).toHaveLength(56);
  });
  it('has no dangling ingredient references', () => {
    expect(findDanglingRefs(dishesFile.dishes, ingredientsFile.ingredients)).toEqual([]);
  });
  it('has unique ids', () => {
    const ids = dishesFile.dishes.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('schema strictness', () => {
  const good = (load('dishes.json') as { dishes: unknown[] }).dishes[0];
  it('rejects a dish with no ingredients', () => {
    expect(RawDishSchema.safeParse({ ...(good as object), ingredients: [] }).success).toBe(false);
  });
  it('rejects an unknown nutrition_basis', () => {
    expect(RawDishSchema.safeParse({ ...(good as object), nutrition_basis: 'guessed' }).success).toBe(false);
  });
  it('finds a dangling reference', () => {
    const d = RawDishSchema.parse(good);
    expect(findDanglingRefs([d], [])).not.toEqual([]);
  });
  it('has exactly 8 nutrient keys', () => {
    expect(NUTRIENT_KEYS).toHaveLength(8);
  });
});
```

**Done when:** `pnpm --filter @sp/contracts test` and `pnpm check` are green.

**Commit:** `feat(contracts): knowledge schemas validating the real data`

**Pitfalls:** If a real-data test fails because a schema is stricter than the data, report it and loosen the **schema** minimally. **Never edit the data files.** Use `import.meta.url` for paths (not `__dirname`).

---

## P0-X03 Contracts: profile, API, analysis, rules and test builders

**Track:** shared · **Depends on:** P0-X02 · **Blocks:** all Phase 1 cards · **Branch:** `x/P0-X03-contracts-core`

**Goal:** every other schema the tracks share, plus builders for tests.

**Read:** `docs/TECH_DESIGN.md` sections 4, 5, 6, 11.

**Files:**
- create `packages/contracts/src/vocab.ts`, `dish.ts`, `profile.ts`, `api.ts`, `analysis.ts`, `rules.ts`, `testing.ts`
- edit `packages/contracts/src/index.ts` (export all except `testing`, which is exported only via `@sp/contracts/testing`)
- create `packages/contracts/test/contracts.test.ts`

**Spec:**

`vocab.ts`:
```ts
import { z } from 'zod';

export const AllergenSchema = z.enum([
  'milk', 'egg', 'fish', 'crustacean_shellfish', 'tree_nuts', 'peanuts',
  'wheat_gluten', 'soy', 'sesame', 'mustard',
]);
export type Allergen = z.infer<typeof AllergenSchema>;

export const ConditionSchema = z.enum(['diabetes', 'hypertension', 'high_cholesterol', 'gastric']);
export type Condition = z.infer<typeof ConditionSchema>;

export const SafetyTagSchema = z.enum(['dairy', 'seafood', 'fried', 'raw-ingredient', 'street-food', 'fermented']);
export type SafetyTag = z.infer<typeof SafetyTagSchema>;

export const SPOILAGE_SIGNS = [
  'visible_mold', 'slimy_surface', 'discoloration', 'bloated_packaging',
  'leaking_packaging', 'separated_liquid', 'foam_or_bubbles', 'foreign_object',
] as const;
export const SpoilageSignSchema = z.enum(SPOILAGE_SIGNS);
export type SpoilageSign = z.infer<typeof SpoilageSignSchema>;

export const CookingClassSchema = z.enum([
  'deep_fried', 'shallow_fried', 'braised_or_curry', 'boiled_or_simmered', 'steamed',
  'baked_or_roasted', 'mashed_or_raw', 'fermented', 'sweet_milk_based', 'mixed_or_other',
]);
export type CookingClass = z.infer<typeof CookingClassSchema>;

export const RulesStatusSchema = z.enum(['draft', 'approved']);
```

`dish.ts` (the normalized dish used by the engine and the web app; the source file keeps the raw form):
```ts
import { z } from 'zod';
import { RawDishSchema } from './knowledge';
import { AllergenSchema, SafetyTagSchema, CookingClassSchema } from './vocab';

export const DishSchema = RawDishSchema.extend({
  allergens: z.array(AllergenSchema),
  safety_tags: z.array(SafetyTagSchema),
  cooking_class: CookingClassSchema,
});
export type Dish = z.infer<typeof DishSchema>;
export const NormalizedDishesFileSchema = z.object({ metadata: z.record(z.unknown()), dishes: z.array(DishSchema).min(1) });
```

`profile.ts`:
```ts
export const UserProfileSchema = z.object({
  conditions: z.array(ConditionSchema),
  allergies: z.array(AllergenSchema),
  language: z.enum(['en', 'bn']),
  consentedAt: z.string().nullable(),
}).strict();
export type UserProfile = z.infer<typeof UserProfileSchema>;
export const EMPTY_PROFILE: UserProfile = { conditions: [], allergies: [], language: 'en', consentedAt: null };
```

`api.ts`:
```ts
export const ScanContextSchema = z.object({
  place: z.enum(['home', 'restaurant', 'street', 'packaged', 'unknown']),
  storage: z.enum(['fresh_just_made', 'room_temp', 'refrigerated', 'unknown']),
  hoursSinceCooked: z.number().min(0).max(240).nullable(),
}).strict();
export type ScanContext = z.infer<typeof ScanContextSchema>;

export const ScanRequestSchema = z.object({
  kind: z.enum(['dish', 'label']),
  imageBase64: z.string().min(100).max(1_800_000),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  context: ScanContextSchema,
}).strict();                       // strict on purpose: the profile must never be accepted
export type ScanRequest = z.infer<typeof ScanRequestSchema>;

const ObservationsSchema = z.object({
  spoilageSigns: z.array(SpoilageSignSchema),
  imageQuality: z.enum(['good', 'poor']),
  notes: z.string().max(300),
});

export const DishScanResultSchema = z.object({
  kind: z.literal('dish'),
  candidates: z.array(z.object({
    dishId: z.string().nullable(),
    label: z.string(),
    confidence: z.number().min(0).max(1),
  })).min(1).max(3),
  observations: ObservationsSchema,
  provider: z.string(),
  cached: z.boolean(),
});

export const LabelScanResultSchema = z.object({
  kind: z.literal('label'),
  productName: z.string().nullable(),
  ingredientsText: z.string().nullable(),
  declaredAllergens: z.array(AllergenSchema),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  nutritionPer100g: NutrientValuesSchema.partial().nullable(),
  observations: ObservationsSchema,
  provider: z.string(),
  cached: z.boolean(),
});

export const ScanResultSchema = z.discriminatedUnion('kind', [DishScanResultSchema, LabelScanResultSchema]);
export type ScanResult = z.infer<typeof ScanResultSchema>;
export type DishScanResult = z.infer<typeof DishScanResultSchema>;
export type LabelScanResult = z.infer<typeof LabelScanResultSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(['bad_request', 'too_large', 'ai_unavailable', 'ai_invalid_output', 'rate_limited', 'internal']),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
```
(import `NutrientValuesSchema` from `./knowledge`.)

`analysis.ts` (engine output):
```ts
const NutrientResultSchema = z.object({
  value: z.number().nullable(),
  coverage: z.number().min(0).max(1),
  shown: z.boolean(),
  origin: z.enum(['lab_scaled', 'calculated', 'none']),
});
export const NutritionResultSchema = z.object({
  perServing: z.object({
    energy_kcal: NutrientResultSchema, protein_g: NutrientResultSchema, fat_g: NutrientResultSchema,
    sat_fat_g: NutrientResultSchema, carbs_g: NutrientResultSchema, sugars_g: NutrientResultSchema,
    fibre_g: NutrientResultSchema, sodium_mg: NutrientResultSchema,
  }),
  overallCoverage: z.number().min(0).max(1),
  missingIngredientIds: z.array(z.string()),
  estimated: z.literal(true),
});
export type NutritionResult = z.infer<typeof NutritionResultSchema>;

export const SafetyResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: z.enum(['low', 'moderate', 'high']),
  signals: z.array(z.object({
    ruleId: z.string(), labelKey: z.string(), points: z.number(),
    evidence: z.string(), sourceRef: z.string().nullable(),
  })),
  mitigationKeys: z.array(z.string()),
  notices: z.array(z.string()).min(1),
  rulesStatus: RulesStatusSchema,
});
export type SafetyResult = z.infer<typeof SafetyResultSchema>;

export const WarningSchema = z.object({
  id: z.string(),
  kind: z.enum(['allergen', 'condition']),
  level: z.enum(['info', 'caution', 'avoid']),
  condition: ConditionSchema.nullable(),
  allergen: AllergenSchema.nullable(),
  messageKey: z.string(),
  params: z.record(z.union([z.string(), z.number()])),
  sourceRef: z.string().nullable(),
});
export type Warning = z.infer<typeof WarningSchema>;

export const SwapSchema = z.object({ dishId: z.string(), improves: z.array(NutrientKeySchema), reasonKey: z.string() });
export const ShoppingItemSchema = z.object({ ingredientId: z.string(), grams: z.number().positive() });

export const AnalysisResultSchema = z.object({
  dishId: z.string().nullable(),
  safety: SafetyResultSchema,
  warnings: z.array(WarningSchema),
  nutrition: NutritionResultSchema.nullable(),
  swaps: z.array(SwapSchema),
  shoppingList: z.array(ShoppingItemSchema),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
```

`rules.ts`:
```ts
export const SafetyTriggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('spoilage_sign'), sign: SpoilageSignSchema }),
  z.object({ type: z.literal('storage_hours'), storage: z.enum(['room_temp', 'refrigerated']), minHours: z.number().min(0), tags: z.array(SafetyTagSchema).optional() }),
  z.object({ type: z.literal('dish_tag'), tag: SafetyTagSchema, place: z.enum(['home', 'restaurant', 'street', 'packaged', 'unknown']).optional() }),
  z.object({ type: z.literal('label_expired') }),
]);
export const SafetyRuleSchema = z.object({
  id: z.string(), trigger: SafetyTriggerSchema, points: z.number().int().min(1).max(100),
  labelKey: z.string(), mitigationKeys: z.array(z.string()), sourceRef: z.string().nullable(), status: RulesStatusSchema,
  basis: z.string().optional(), // short paraphrase of what the cited source says, with section or page
});
export const SafetyRulesFileSchema = z.object({ rules: z.array(SafetyRuleSchema) });
export type SafetyRule = z.infer<typeof SafetyRuleSchema>;

export const NutrientRuleSchema = z.object({
  kind: z.literal('nutrient'), id: z.string(), condition: ConditionSchema, nutrient: NutrientKeySchema,
  dailyLimit: z.number().positive(), cautionFraction: z.number().min(0).max(1), avoidFraction: z.number().min(0).max(1),
  messageKey: z.string(), sourceRef: z.string(), status: RulesStatusSchema, basis: z.string().optional(),
}).refine((r) => r.avoidFraction >= r.cautionFraction, { message: 'avoidFraction must be >= cautionFraction' });
export const TagRuleSchema = z.object({
  kind: z.literal('tag'), id: z.string(), condition: ConditionSchema,
  match: z.union([
    z.object({ cookingClasses: z.array(CookingClassSchema).min(1) }),
    z.object({ safetyTags: z.array(SafetyTagSchema).min(1) }),
  ]),
  level: z.enum(['info', 'caution']), messageKey: z.string(), sourceRef: z.string(), status: RulesStatusSchema, basis: z.string().optional(),
});
export const HealthRulesFileSchema = z.object({ rules: z.array(z.union([NutrientRuleSchema, TagRuleSchema])) });
export type NutrientRule = z.infer<typeof NutrientRuleSchema>;
export type TagRule = z.infer<typeof TagRuleSchema>;
export type HealthRule = NutrientRule | TagRule;

export const SourceEntrySchema = z.object({
  id: z.string(), title: z.string(), publisher: z.string(),
  year: z.number().int().nullable(), edition: z.string().nullable(), url: z.string().url(),
  tier: z.enum(['bangladesh', 'global', 'professional', 'data']),
  status: z.enum(['verified', 'unverified']),
  accessedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  notes: z.string().optional(),
});
export const SourcesFileSchema = z.object({ sources: z.array(SourceEntrySchema) });
export type SourceEntry = z.infer<typeof SourceEntrySchema>;

/** messageKey to text in both languages. Placeholders look like {name}. */
export const MessagesFileSchema = z.record(z.object({ en: z.string().min(1), bn: z.string().min(1) }));
export type Messages = z.infer<typeof MessagesFileSchema>;
```
(Note: `z.union` over a `ZodEffects` (refine) is allowed. A discriminated union is not used there for that reason.)

`testing.ts` (builders, no randomness):
```ts
import type { Ingredient, RawDish } from './knowledge';
import type { UserProfile } from './profile';
import { EMPTY_PROFILE } from './profile';

/** Returns a valid ingredient with all nutrients null unless overridden. */
export function makeIngredient(over: Partial<Ingredient> & { id: string }): Ingredient {
  return {
    name_en: over.id, name_bn: '', basis: 'per_100_g_raw_ingredient',
    energy_kcal: null, protein_g: null, fat_g: null, sat_fat_g: null,
    carbs_g: null, sugars_g: null, fibre_g: null, sodium_mg: null,
    source: [], nutrient_sources: {}, ...over,
  } as Ingredient;
}

/** Returns a valid dish with one 100 g ingredient line unless overridden. */
export function makeDish(over: Partial<RawDish> & { id: string }): RawDish {
  return {
    name_en: over.id, name_bn: '', aliases: [], category: 'test',
    serving_description: '1 serving (estimated)', serving_weight_g: 200, serving_weight_basis: 'ESTIMATE',
    ingredients: [{ ingredient_id: 'x', grams_raw: 100, quantity_basis: 'ESTIMATE' }],
    cooking_method: 'test', allergens: [], safety_tags: [], nutrition_basis: 'unavailable',
    lab_values_per_serving: null, sources: [], confidence: 'low', needs_expert_review: true,
    notes: [], batch_number: 1, ...over,
  } as RawDish;
}

/** Returns a profile with the given overrides. */
export function makeProfile(over: Partial<UserProfile> = {}): UserProfile {
  return { ...EMPTY_PROFILE, ...over };
}
```

**Tests (write first)** `packages/contracts/test/contracts.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  ScanRequestSchema, ScanResultSchema, UserProfileSchema, SafetyResultSchema,
  NutrientRuleSchema, SPOILAGE_SIGNS, DishSchema, SourceEntrySchema, MessagesFileSchema,
} from '../src';
import { makeDish, makeIngredient, makeProfile } from '../src/testing';
import { RawDishSchema, IngredientSchema } from '../src/knowledge';

const img = 'A'.repeat(200);
const ctx = { place: 'home', storage: 'unknown', hoursSinceCooked: null } as const;

describe('ScanRequest', () => {
  it('accepts a valid request', () => {
    expect(ScanRequestSchema.safeParse({ kind: 'dish', imageBase64: img, mimeType: 'image/jpeg', context: ctx }).success).toBe(true);
  });
  it('rejects any extra field, so a health profile can never be sent', () => {
    const r = ScanRequestSchema.safeParse({ kind: 'dish', imageBase64: img, mimeType: 'image/jpeg', context: ctx, profile: { conditions: ['diabetes'] } });
    expect(r.success).toBe(false);
  });
  it('rejects an oversized image', () => {
    expect(ScanRequestSchema.safeParse({ kind: 'dish', imageBase64: 'A'.repeat(1_800_001), mimeType: 'image/jpeg', context: ctx }).success).toBe(false);
  });
  it('rejects an unsupported mime type', () => {
    expect(ScanRequestSchema.safeParse({ kind: 'dish', imageBase64: img, mimeType: 'image/gif', context: ctx }).success).toBe(false);
  });
});

describe('ScanResult', () => {
  it('discriminates on kind', () => {
    const dish = { kind: 'dish', candidates: [{ dishId: 'kacchi-biryani', label: 'Kacchi Biryani', confidence: 0.8 }],
      observations: { spoilageSigns: [], imageQuality: 'good', notes: '' }, provider: 'mock', cached: false };
    expect(ScanResultSchema.parse(dish).kind).toBe('dish');
  });
  it('rejects an unknown spoilage sign', () => {
    const bad = { kind: 'dish', candidates: [{ dishId: null, label: 'x', confidence: 0.1 }],
      observations: { spoilageSigns: ['smells_bad'], imageQuality: 'good', notes: '' }, provider: 'mock', cached: false };
    expect(ScanResultSchema.safeParse(bad).success).toBe(false);
  });
  it('lists 8 spoilage signs', () => { expect(SPOILAGE_SIGNS).toHaveLength(8); });
});

describe('profile and rules', () => {
  it('rejects unknown profile fields', () => {
    expect(UserProfileSchema.safeParse({ ...makeProfile(), name: 'x' }).success).toBe(false);
  });
  it('requires at least one notice on a safety result', () => {
    const base = { score: 0, level: 'low', signals: [], mitigationKeys: [], notices: [], rulesStatus: 'draft' };
    expect(SafetyResultSchema.safeParse(base).success).toBe(false);
  });
  it('requires avoidFraction >= cautionFraction', () => {
    const r = { kind: 'nutrient', id: 'r1', condition: 'hypertension', nutrient: 'sodium_mg', dailyLimit: 1000,
      cautionFraction: 0.5, avoidFraction: 0.2, messageKey: 'warn.sodium_high', sourceRef: 's1', status: 'draft' };
    expect(NutrientRuleSchema.safeParse(r).success).toBe(false);
  });
});

describe('normalized dish, sources, messages', () => {
  const raw = makeDish({ id: 'd1' });
  it('DishSchema needs a cooking class and canonical allergens', () => {
    expect(DishSchema.safeParse({ ...raw, cooking_class: 'steamed' }).success).toBe(true);
    expect(DishSchema.safeParse(raw).success).toBe(false);
    expect(DishSchema.safeParse({ ...raw, cooking_class: 'steamed', allergens: ['dairy'] }).success).toBe(false);
    expect(DishSchema.safeParse({ ...raw, cooking_class: 'steamed', allergens: ['milk'] }).success).toBe(true);
  });
  it('SourceEntrySchema requires a url and a known tier and status', () => {
    const ok = { id: 's1', title: 'T', publisher: 'P', year: 2025, edition: null, url: 'https://example.org/a', tier: 'bangladesh', status: 'unverified', accessedOn: null };
    expect(SourceEntrySchema.safeParse(ok).success).toBe(true);
    expect(SourceEntrySchema.safeParse({ ...ok, url: 'not a url' }).success).toBe(false);
    expect(SourceEntrySchema.safeParse({ ...ok, status: 'maybe' }).success).toBe(false);
  });
  it('MessagesFileSchema needs both languages', () => {
    expect(MessagesFileSchema.safeParse({ 'a.b': { en: 'x', bn: 'y' } }).success).toBe(true);
    expect(MessagesFileSchema.safeParse({ 'a.b': { en: 'x' } }).success).toBe(false);
  });
});

describe('builders', () => {
  it('build valid objects', () => {
    expect(RawDishSchema.safeParse(makeDish({ id: 'd1' })).success).toBe(true);
    expect(IngredientSchema.safeParse(makeIngredient({ id: 'x' })).success).toBe(true);
  });
});
```

**Done when:** `pnpm --filter @sp/contracts test` and `pnpm check` are green.

**Commit:** `feat(contracts): profile, api, analysis, rules schemas and test builders`

**Pitfalls:** The health profile is never part of `ScanRequest`; do not "helpfully" add it. Keep the vocabularies exactly as in `TECH_DESIGN.md` section 11. After this card merges, the contract is frozen except through `contract-change` cards.

---

## P0-X04 Mock scans and the knowledge loader

**Track:** shared · **Depends on:** P0-X03 · **Blocks:** Phase 1 · **Branch:** `x/P0-X04-fixtures-loader`

**Goal:** mock scan results every track can use, and a loader that gives typed access to the real data.

**Read:** `TECH_DESIGN.md` sections 3, 5.

**Files:**
- create `packages/knowledge/src/index.ts`, `packages/knowledge/test/loader.test.ts`
- create `fixtures/mock-scan/dish-kacchi-biryani.json`, `dish-shutki-bhorta.json`, `dish-mishti-doi-spoiled.json`, `dish-unknown.json`, `label-snack.json`, `label-poor-quality.json`
- create `packages/contracts/test/fixtures.test.ts` (the fixtures folder holds data only, never tests)
- edit `packages/knowledge/package.json` (add dependency `@sp/contracts`: `workspace:*`)

**Spec:**

`packages/knowledge/src/index.ts`:
```ts
import dishesFile from '../data/source/dishes.json';
import ingredientsFile from '../data/source/ingredients.json';
import {
  RawDishesFileSchema, RawIngredientsFileSchema,
  type RawDish, type Ingredient,
} from '@sp/contracts';

/** Returns the 30 validated source dishes. */
export function getRawDishes(): RawDish[] { return RawDishesFileSchema.parse(dishesFile).dishes; }
/** Returns the 56 validated source ingredients. */
export function getRawIngredients(): Ingredient[] { return RawIngredientsFileSchema.parse(ingredientsFile).ingredients; }
/** Returns a map from ingredient id to ingredient. */
export function ingredientsById(list: Ingredient[] = getRawIngredients()): Map<string, Ingredient> {
  return new Map(list.map((i) => [i.id, i]));
}
```
Later cards (P1-D01 and P1-D04) switch these loaders to the normalized data; the function names stay the same.

Fixture shape = `ScanResult` (see `api.ts`). Make them realistic:
- `dish-kacchi-biryani.json`: candidates `kacchi-biryani` 0.82, `beef-tehari` 0.12, `morog-polao` 0.04; spoilageSigns `[]`; imageQuality `good`; provider `mock`; cached `false`.
- `dish-shutki-bhorta.json`: `shutki-bhorta` 0.7, `begun-bhorta` 0.2, `aloo-bhorta` 0.1.
- `dish-mishti-doi-spoiled.json`: `mishti-doi` 0.75, `rasmalai` 0.15, `shemai` 0.1; spoilageSigns `["separated_liquid","foam_or_bubbles"]`.
- `dish-unknown.json`: one candidate `dishId: null`, label `"Unrecognized dish"`, confidence 0.2; imageQuality `poor`.
- `label-snack.json`: kind `label`, productName `"Test Snack"`, ingredientsText `"wheat flour, palm oil, salt, milk powder"`, declaredAllergens `["wheat_gluten","milk"]`, expiryDate `"2026-12-01"`, nutritionPer100g `{ "sodium_mg": 600, "sugars_g": 5 }`.
- `label-poor-quality.json`: kind `label`, all text fields null, declaredAllergens `[]`, expiryDate null, nutritionPer100g null, imageQuality `poor`.

**Tests (write first)**

`packages/knowledge/test/loader.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getRawDishes, getRawIngredients, ingredientsById } from '../src';

describe('knowledge loader', () => {
  it('loads 30 dishes and 56 ingredients', () => {
    expect(getRawDishes()).toHaveLength(30);
    expect(getRawIngredients()).toHaveLength(56);
  });
  it('resolves every dish ingredient', () => {
    const map = ingredientsById();
    for (const d of getRawDishes()) for (const l of d.ingredients) expect(map.has(l.ingredient_id)).toBe(true);
  });
});
```

`packages/contracts/test/fixtures.test.ts`:
```ts
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { ScanResultSchema } from '../src';
import { RawDishesFileSchema } from '../src/knowledge';

const dir = fileURLToPath(new URL('../../../fixtures/mock-scan/', import.meta.url));
const dishes = RawDishesFileSchema.parse(JSON.parse(readFileSync(
  fileURLToPath(new URL('../../knowledge/data/source/dishes.json', import.meta.url)), 'utf8'))).dishes;
const ids = new Set(dishes.map((d) => d.id));
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('mock scan fixtures', () => {
  it('has at least 6 fixtures', () => { expect(files.length).toBeGreaterThanOrEqual(6); });
  for (const f of files) {
    it(`${f} is a valid ScanResult`, () => {
      const parsed = ScanResultSchema.parse(JSON.parse(readFileSync(dir + f, 'utf8')));
      if (parsed.kind === 'dish') {
        for (const c of parsed.candidates) if (c.dishId !== null) expect(ids.has(c.dishId)).toBe(true);
      }
    });
  }
});
```

**Done when:** `pnpm check` is green.

**Commit:** `feat(knowledge): typed loaders for source data; test: mock scan fixtures`

**Pitfalls:** The fixtures folder holds JSON only. Candidate dish ids must exist in `dishes.json`.

---

## P0-D01 Fetch raw sources, or notify

**Track:** D (any track may run it) · **Depends on:** P0-X01 · **Blocks:** P1-D02, P1-D03 · **Branch:** `d/P0-D01-fetch-raw`

**Goal:** try to download the Food Composition Table for Bangladesh PDF and the USDA FoodData Central CSV files into `data/raw/`. If the agent cannot (no network, blocked, link changed), it **stops and prints exact steps** for a human. It must never fabricate files.

**Read:** `docs/TECH_DESIGN.md` section 3. The FCTB url is in `ingredients.json` under `metadata.allowed_sources[0].url`.

**Files:**
- create `tools/src/fetch-raw.ts`, `tools/src/fetch-raw-lib.ts`, `tools/test/fetch-raw-lib.test.ts`
- edit `tools/package.json` (add script `"fetch-raw": "tsx src/fetch-raw.ts"`)

**Spec** (`fetch-raw-lib.ts`, pure and testable):
```ts
export interface RawTarget { id: string; url: string | null; dest: string; manualHint: string; }
/** Returns the list of files to fetch. url is null where the agent must find the current official link itself. */
export function planTargets(fctbUrl: string): RawTarget[];
/** Returns a human-readable instruction block for targets that could not be fetched. */
export function humanInstructions(failed: RawTarget[]): string;
/** Returns true if the file name looks like a PDF by extension and non-empty size. */
export function looksValid(name: string, bytes: number): boolean;
```
- `planTargets` returns two targets: `fctb` (url = argument, dest `data/raw/fctb-2013.pdf`) and `usda` (url `null`, dest `data/raw/usda/`, manualHint: open the official FoodData Central download page and download the CSV datasets for the SR Legacy and Foundation Foods releases; unzip into `data/raw/usda/`).
- `fetch-raw.ts`: for each target with a URL, try `fetch`; save only if `looksValid`. For the USDA target: **find the current link on the official FoodData Central download page** (fetch that page and read the links). Do **not** guess file names. Any failure leads to `process.exitCode = 2` and printing `humanInstructions(failed)`. Success prints the saved paths and sizes.

**Tests (write first)** `tools/test/fetch-raw-lib.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { planTargets, humanInstructions, looksValid } from '../src/fetch-raw-lib';

describe('planTargets', () => {
  const t = planTargets('https://example.org/fctb.pdf');
  it('plans two targets', () => { expect(t.map((x) => x.id)).toEqual(['fctb', 'usda']); });
  it('puts raw files under data/raw', () => { expect(t.every((x) => x.dest.startsWith('data/raw/'))).toBe(true); });
  it('leaves the USDA url for the agent to find', () => { expect(t[1]?.url).toBeNull(); });
});
describe('humanInstructions', () => {
  it('names each failed target and its destination', () => {
    const txt = humanInstructions(planTargets('https://example.org/fctb.pdf'));
    expect(txt).toContain('data/raw/fctb-2013.pdf');
    expect(txt).toContain('data/raw/usda/');
  });
  it('is empty when nothing failed', () => { expect(humanInstructions([])).toBe(''); });
});
describe('looksValid', () => {
  it('accepts a non-empty pdf', () => { expect(looksValid('a.pdf', 5000)).toBe(true); });
  it('rejects an empty file', () => { expect(looksValid('a.pdf', 0)).toBe(false); });
  it('rejects an html error page saved as pdf name', () => { expect(looksValid('a.html', 5000)).toBe(false); });
});
```

**Done when:** `pnpm --filter @sp/tools test` and `pnpm check` green. Then run `pnpm --filter @sp/tools fetch-raw` and **paste the output in the report**. If exit code is 2, a human follows the printed steps (P0-H02).

**Commit:** `feat(tools): fetch raw FCTB and USDA sources or print manual steps`

**Pitfalls:** Check each site's terms of use; do not scrape beyond downloading the published files. `data/raw/` is gitignored; never commit the downloaded files.
