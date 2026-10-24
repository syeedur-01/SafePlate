# PHASE 4: Hardening (Fri Oct 30)

**Goal:** a stable build to record the demo from. **Bug fixes only.** No new features, no new dependencies, no refactors.

**Exit criteria:** `pnpm check` green on `main`; the public URL works on two phones; `pnpm verify` green; tag `mvp-demo` pushed. The team records the video from this tag. Saturday Oct 31 is buffer: re-record or fix, then submit early.

The demo video and the submission are done by the team, not by agents.

---

## P4-X01 Demo scenarios

**Track:** C · **Branch:** `c/P4-X01-demo`

**Goal:** four scripted scenarios that run the **real engine and real data** offline, so the video is repeatable and a judge can try them without a camera or AI quota. They use a temporary in-memory profile and **never** touch the saved one.

**Files:** create `apps/web/src/demo/scenarios.ts`, `apps/web/src/demo/run-scenario.ts`, `apps/web/src/pages/Demo.tsx`, `apps/web/test/demo.test.ts`; edit `App.tsx` (route `/demo`, link from the Scan page).

**Spec:**
```ts
export interface Scenario {
  id: string; titleKey: string; fixture: string;       // file stem in fixtures/mock-scan
  dishId: string | null;
  profile: Pick<UserProfile, 'conditions' | 'allergies'>;
  context: ScanContext; servings: number;
}
export const SCENARIOS: Scenario[];
/** Runs the real engine on a scenario and returns the analysis. today is injected. */
export function runScenario(s: Scenario, today: string): AnalysisResult;
```
Scenarios:
1. `festive-rice-blood-pressure`: fixture `dish-kacchi-biryani`, dish `kacchi-biryani`, profile conditions `['hypertension']`.
2. `dairy-sweet-left-out`: fixture `dish-mishti-doi-spoiled`, dish `mishti-doi`, context `{ place: 'home', storage: 'room_temp', hoursSinceCooked: 6 }`.
3. `label-with-milk-allergy`: fixture `label-snack`, dish `null`, profile allergies `['milk']`.
4. `fish-allergy-bhorta`: fixture `dish-shutki-bhorta`, dish `shutki-bhorta`, profile allergies `['fish']`.
(The unknown-dish fixture is used by the sample picker in P3-X06.)

**Tests (write first):**
```ts
import { describe, it, expect } from 'vitest';
import { AnalysisResultSchema } from '@sp/contracts';
import { SCENARIOS } from '../src/demo/scenarios';
import { runScenario } from '../src/demo/run-scenario';
describe('demo scenarios', () => {
  it('has four scenarios with unique ids', () => { expect(SCENARIOS).toHaveLength(4); expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(4); });
  it('runs the real engine and validates for every scenario', () => {
    for (const s of SCENARIOS) expect(AnalysisResultSchema.safeParse(runScenario(s, '2026-10-30')).success, s.id).toBe(true);
  });
  it('puts an allergen warning first in the allergy scenarios', () => {
    for (const id of ['label-with-milk-allergy', 'fish-allergy-bhorta']) {
      const s = SCENARIOS.find((x) => x.id === id)!;
      expect(runScenario(s, '2026-10-30').warnings[0]?.kind, id).toBe('allergen');
    }
  });
  it('always carries the chemical-limit notice', () => {
    for (const s of SCENARIOS) expect(runScenario(s, '2026-10-30').safety.notices[0]).toBe('notice.chemical_limit');
  });
  it('does not change the saved profile', () => {
    localStorage.setItem('sp.profile.v1', 'SENTINEL');
    for (const s of SCENARIOS) runScenario(s, '2026-10-30');
    expect(localStorage.getItem('sp.profile.v1')).toBe('SENTINEL');
  });
});
```
Do **not** assert specific scores or nutrient numbers: those depend on rules and data that the expert may still change.

**Done when:** green. **Commit:** `feat(web): scripted demo scenarios running the real engine`

---

## P4-X02 Bug-fix queue (process, not a feature)

**Track:** any · **Branch per bug:** `<track>/BUG-<n>-<slug>`

Keep a table in `docs/BUGS.md`: id, severity, where, how to reproduce, owner, status.

| Severity | Meaning | Allowed after freeze? |
|---|---|---|
| P0 | Crashes, wrong safety or allergen result, privacy leak, secret exposed | Yes, immediately |
| P1 | Broken main flow on a phone, wrong or misleading text, missing "estimated" or "draft" label | Yes |
| P2 | Cosmetic, minor wording | **No.** Add to the Phase 5 list |

**Every bug fix is a mini-card:** (1) write a failing test that reproduces it; (2) make the smallest change that fixes it; (3) `pnpm check` green; (4) commit `fix(<area>): <bug id> <what>`; (5) report. No other changes in the same branch.

---

## P4-X03 Final data and wiring consistency check

**Track:** D · **Branch:** `d/P4-X03-verify`

**Goal:** one command, `pnpm verify`, that fails loudly if data, rules, messages and sources disagree.

**Files:** create `tools/src/verify-lib.ts`, `tools/src/verify.ts`, `tools/test/verify-lib.test.ts`; edit root `package.json` (script `verify`: `pnpm --filter @sp/tools verify`), `.github/workflows/ci.yml` (add `pnpm verify` after `pnpm check`).

**Spec:**
```ts
export interface VerifyInput {
  dishes: Dish[]; ingredients: Ingredient[]; safetyRules: SafetyRule[]; healthRules: HealthRule[];
  messages: Record<string, { en: string; bn: string }>; sourceIds: Set<string>;
}
/** Returns human-readable problems. An empty array means everything is consistent. */
export function verifyAll(input: VerifyInput): string[];
```
Checks: no dangling ingredient references; every rule's `sourceRef` exists in `sourceIds`; every `labelKey`, `mitigationKey` and `messageKey` exists in `messages`; every ingredient id used by a dish exists; unique dish and ingredient ids; no nutrient value is negative or `NaN`; every dish has `serving_weight_g > 0`. `verify.ts` loads the real data, prints the problems and a one-line summary (dish count, ingredient count, rules by status), and exits with code 1 if there are problems.

**Tests (write first):**
```ts
import { describe, it, expect } from 'vitest';
import { makeDish, makeIngredient } from '@sp/contracts/testing';
import { verifyAll, type VerifyInput } from '../src/verify-lib';
const ok = (): VerifyInput => ({
  dishes: [makeDish({ id: 'd', ingredients: [{ ingredient_id: 'x', grams_raw: 10, quantity_basis: 'ESTIMATE' }] }) as never],
  ingredients: [makeIngredient({ id: 'x', energy_kcal: 100 })], safetyRules: [], healthRules: [], messages: {}, sourceIds: new Set(),
});
describe('verifyAll', () => {
  it('passes consistent data', () => { expect(verifyAll(ok())).toEqual([]); });
  it('reports a dangling ingredient', () => { const i = ok(); i.ingredients = []; expect(verifyAll(i).join('\n')).toContain('x'); });
  it('reports a rule with an unknown source', () => {
    const i = ok(); i.safetyRules = [{ id: 'r', trigger: { type: 'label_expired' }, points: 5, labelKey: 'safety.r', mitigationKeys: [], sourceRef: 'nope', status: 'draft' }];
    expect(verifyAll(i).join('\n')).toContain('nope');
  });
  it('reports a missing message key', () => {
    const i = ok(); i.sourceIds = new Set(['s']);
    i.safetyRules = [{ id: 'r', trigger: { type: 'label_expired' }, points: 5, labelKey: 'safety.r', mitigationKeys: ['mitigation.m'], sourceRef: 's', status: 'draft' }];
    const text = verifyAll(i).join('\n');
    expect(text).toContain('safety.r'); expect(text).toContain('mitigation.m');
  });
  it('reports a negative nutrient value', () => { const i = ok(); i.ingredients = [makeIngredient({ id: 'x', energy_kcal: -1 })]; expect(verifyAll(i).length).toBeGreaterThan(0); });
  it('reports duplicate dish ids', () => { const i = ok(); i.dishes = [i.dishes[0]!, i.dishes[0]!]; expect(verifyAll(i).join('\n')).toContain('d'); });
});
```
**Done when:** green and `pnpm verify` prints a clean summary (paste it). **Commit:** `feat(tools): verify command for data, rules, messages and sources`

---

## P4-X04 Performance

**Track:** C · **Branch:** `c/P4-X04-perf`

**Goal:** the app loads quickly on a mid-range phone on mobile data, without adding features.

**Files:** create `apps/web/src/lib/size-report.ts`, `apps/web/scripts/size.ts`, `apps/web/test/size-report.test.ts`; edit `apps/web/src/App.tsx` (lazy-load pages with `React.lazy` and `Suspense`), `apps/web/index.html` (`font-display: swap` via the Google Fonts URL `&display=swap`), `apps/web/package.json` (script `size`: `tsx scripts/size.ts`).

**Spec:**
```ts
/** Sums gzip sizes (bytes) of files and returns a printable table plus the total. */
export function summarizeSizes(entries: Array<{ file: string; gzipBytes: number }>): { total: number; lines: string[] };
/** Returns true if total is within budget. */
export function withinBudget(total: number, budget: number): boolean;
```
`scripts/size.ts` reads `apps/web/dist/assets/*.js` and `*.css`, gzips each with `node:zlib`, prints the table, and **fails if the JS total exceeds the budget**. Set the budget as **the first measured total plus 10 percent**, store it in `apps/web/size-budget.json`, and report both numbers. Also confirm: the `runtime.json` knowledge data is imported **once** (not duplicated across chunks), and images from the user are never bundled.

**Tests (write first):**
```ts
import { describe, it, expect } from 'vitest';
import { summarizeSizes, withinBudget } from '../src/lib/size-report';
describe('size report', () => {
  it('sums and prints sizes', () => {
    const r = summarizeSizes([{ file: 'a.js', gzipBytes: 1000 }, { file: 'b.js', gzipBytes: 2500 }]);
    expect(r.total).toBe(3500); expect(r.lines).toHaveLength(2); expect(r.lines[0]).toContain('a.js');
  });
  it('compares to a budget inclusively', () => { expect(withinBudget(100, 100)).toBe(true); expect(withinBudget(101, 100)).toBe(false); });
});
```
**Done when:** green; `pnpm --filter @sp/web build && pnpm --filter @sp/web size` passes (paste the table). **Commit:** `perf(web): lazy-loaded pages and bundle size budget`

---

## P4-X05 README, disclaimers and the `mvp-demo` tag

**Track:** human plus any agent · **Branch:** `x/P4-X05-readme`

**Files:** create `README.md`, `docs/KNOWN_LIMITATIONS.md`; edit `docs/BUGS.md`.

**Content (agent drafts, humans read every line):**
- `README.md`: what SafePlate is (two sentences), the live URL, how to run locally (`pnpm install`, `pnpm --filter @sp/web dev`, `pnpm --filter @sp/api dev`), the stack, the folder map, the data policy ("source files are never edited; derived files are generated"), how AI is used and **how it is not** ("AI reads the photo; code decides"), the AI usage statement (which tools helped write the code: agents, models), privacy (profile stays on the device), and the team.
- `docs/KNOWN_LIMITATIONS.md`, honest and specific: nutrient values are estimates from estimated recipes; some dishes show "not enough data"; rules are drafts unless approved by the expert; the check cannot detect invisible chemical contamination; photo recognition can be wrong, so the app asks you to confirm; the free AI quota is small; the allergen keyword list is conservative and incomplete; Bangla text was machine-drafted and reviewed by native speakers (say what was actually reviewed).

**Tests:** none for prose. The agent's definition of done is `pnpm check` green and `README.md` not mentioning anything the app does not do.

**Human steps (the repo owner):**
1. Confirm `main` is green and `pnpm verify` is clean.
2. `git tag mvp-demo && git push origin mvp-demo`.
3. Deploy the tagged build (Worker and Pages) and run `tools/src/smoke.ts` again.
4. Record the video from the deployed site on a phone (suggested storyline: the problem in one sentence; Kacchi Biryani with a blood-pressure profile; the spoiled Mishti Doi with the evidence list; the allergy label; the Bangla switch; the limits slide that says what the app cannot do).
5. Submit before the buffer day if possible; confirm the exact cutoff and time zone with the organizers.

**Commit:** `docs: readme, known limitations and demo notes`
