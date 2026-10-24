# PHASE 3: Integration and deploy (Wed Oct 28 to Thu Oct 29)

**Goal:** replace mocks with the real engine, the real API and real data; deploy to Cloudflare; test on phones; measure on the team's photos.

**Feature freeze: Thursday Oct 29, night.** After that only Phase 4 bug fixes.

**Exit criteria:** all P3 cards merged (or cut by the order in the index); the public URL works on two real phones; `docs/EVAL_REPORT.md` exists; data frozen; tag `phase-3-done`.

| Card                                                 | Track         | Depends on                    |
| ---------------------------------------------------- | ------------- | ----------------------------- |
| P3-X01 Web connected to the real API                 | C             | P2-B01, P2-B03, P2-C01        |
| P3-X02 Engine wired into the Result page             | C with A      | P2-A04, P2-C02 to C04, P2-D06 |
| P3-X03 End-to-end pipeline test and privacy scan     | B             | P2-B01, P2-A04                |
| P3-X04 Cloudflare deploy                             | B and a human | P2-B04, P3-X01                |
| P3-X05 Evaluation on real photos                     | D with B      | P2-D05, P3-X04                |
| P3-X06 Low confidence, errors, waking state, samples | C             | P3-X01                        |
| P3-X07 Responsive and accessibility pass             | C             | P3-X02                        |
| P3-X08 Data freeze                                   | D             | P2-D06                        |

Order: X01 and X02 first (parallel), X03 beside them, then X04, then X05, X06, X07, X08.

---

## P3-X01 Web connected to the real API

**Track:** C · **Branch:** `c/P3-X01-real-api`

**Goal:** the scan page talks to `/api/scan` for real; `VITE_USE_MOCK` becomes opt-in only. A test proves the web client and the API agree on the contract **without a network**.

**Files:** create `apps/web/test/contract-integration.test.ts`; edit `apps/web/src/api/client.ts`, `apps/web/package.json` (dev dependency `@sp/api`: `workspace:*`), `apps/web/.env.example` (`VITE_API_BASE=`, `VITE_USE_MOCK=`).

**Spec:** `scan()` uses the mock only when `import.meta.env.VITE_USE_MOCK === '1'`. Everything else already exists from P1-C03.

**Tests (write first):**

```ts
import { describe, it, expect } from 'vitest';
import { MockProvider } from '@sp/ai';
import { createApp } from '@sp/api/src/app';
import { scan } from '../src/api/client';

const app = createApp({
  allowedOrigin: 'http://localhost:5173',
  maxBodyBytes: 2_000_000,
  provider: new MockProvider(),
  dishes: [],
});
// Route the client's fetch into the API app in-process: no network, same contract.
const fetchFn = ((url: string, init?: RequestInit) =>
  app.request(new URL(url, 'http://local').pathname, init)) as unknown as typeof fetch;
const req = (kind: 'dish' | 'label') => ({
  kind,
  imageBase64: 'Q'.repeat(300),
  mimeType: 'image/jpeg' as const,
  context: { place: 'home' as const, storage: 'unknown' as const, hoursSinceCooked: null },
});

describe('web client against the real api app', () => {
  it('gets a valid dish result', async () => {
    expect((await scan(req('dish'), { baseUrl: 'http://local', fetchFn })).kind).toBe('dish');
  });
  it('gets a valid label result', async () => {
    expect((await scan(req('label'), { baseUrl: 'http://local', fetchFn })).kind).toBe('label');
  });
  it('turns an api error into ApiClientError', async () => {
    const bad = { ...req('dish'), imageBase64: 'short' };
    await expect(scan(bad as never, { baseUrl: 'http://local', fetchFn })).rejects.toThrow();
  });
});
```

**Done when:** green. **Commit:** `feat(web): real api client with in-process contract test`

---

## P3-X02 Engine wired into the Result page

**Track:** C (with A for questions) · **Depends on:** P2-A04, P2-C02, P2-C03, P2-C04, P2-D06 · **Branch:** `c/P3-X02-wire-engine`

**Goal:** the Result page computes everything on the device from the scan, the chosen dish, the saved profile and the knowledge data.

**Files:** create `apps/web/src/state/useAnalysis.ts`, `apps/web/test/use-analysis.test.tsx`, `apps/web/test/result-page.test.tsx`; edit `src/pages/Result.tsx`, `src/pages/Confirm.tsx` (save a history entry on arrival at `/result`), `apps/web/package.json` (`@sp/engine`).

**Spec:**

```ts
export function useAnalysis(args: {
  scanResult: ScanResult;
  dishId: string | null;
  servings: number;
  profile: UserProfile;
  now: () => Date;
}): AnalysisResult;
```

It builds `AnalyzeInput` from `@sp/knowledge` (`getDishes`, `getIngredients` as a map, `getSafetyRules`, `getHealthRules`, `getAllergenKeywords`), the scan's observations and label fields, context defaults (`place: 'unknown'`, `storage: 'unknown'`, `hoursSinceCooked: null` unless the scan page passed a context in router state), and `today` from `now()` formatted as `YYYY-MM-DD` in UTC. Memoize on its arguments. The profile is read from the local store only.

**Tests (write first):**

- `useAnalysis`, using the real knowledge data and `renderHook`: (1) for the `kacchi-biryani` dish fixture with an empty profile the result validates with `AnalysisResultSchema` and `warnings` has no allergen entries; (2) with `allergies: ['milk']` the first warning is an allergen warning when the dish lists milk (find any real dish that does, via `getDishes()`); (3) for a label fixture with declared `milk` and a milk-allergic profile the first warning is an allergen warning; (4) changing `servings` from 1 to 2 doubles each shopping-list gram value.
- Privacy: spy on `globalThis.fetch` and `XMLHttpRequest.prototype.open`, render the Result page with a profile that has conditions, and assert **no network call is made during analysis**.
- `result-page.test.tsx`: the page renders the four tabs and the chemical notice for the kacchi fixture; "estimated" badge visible on the Nutrition tab; the "draft rules" badge is visible when any loaded rule is draft.

**Done when:** green. **Commit:** `feat(web): wire engine and knowledge data into the result page`

---

## P3-X03 End-to-end pipeline test and privacy scan

**Track:** B · **Branch:** `b/P3-X03-e2e-privacy`

**Goal:** one test that runs scan request → API → engine for every mock fixture, and a static test that the server side can never touch the health profile.

**Files:** create `apps/api/test/e2e.test.ts`, `apps/api/test/privacy-scan.test.ts`; edit `apps/api/package.json` (dev dependency `@sp/engine`).

**Tests (write first):**

```ts
// privacy-scan.test.ts: no server code mentions the profile or health conditions
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
const dirs = ['../src/', '../../../packages/ai/src/'].map((d) =>
  fileURLToPath(new URL(d, import.meta.url)),
);
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
describe('server code never handles the health profile', () => {
  it('has no reference to profile, conditions or diabetes-type words', () => {
    const offenders = dirs
      .flatMap(files)
      .filter((f) =>
        /\b(profile|conditions|hypertension|diabetes|cholesterol|gastric)\b/i.test(
          readFileSync(f, 'utf8').replace(/\/\/.*$/gm, ''),
        ),
      );
    expect(offenders).toEqual([]);
  });
});
```

(The regex ignores `//` comments. If a legitimate word appears in a comment only, that is fine; if it appears in code, rename it.)
`e2e.test.ts`: for each file in `fixtures/mock-scan/`, send a request through `createApp` with `forceFixture` style selection (use `new MockProvider({ forceFixture: <stem> })`), take the JSON result, call the engine `analyze` with the real knowledge data and `makeProfile()`, and assert the output passes `AnalysisResultSchema`. For dish fixtures with `dishId: null` as the first candidate, call `analyze` with the **first non-null candidate** or skip with a comment explaining why.

**Done when:** green. **Commit:** `test(api): end-to-end pipeline and server privacy scan`

---

## P3-X04 Cloudflare deploy (agent writes config, humans deploy)

**Track:** B plus a human · **Depends on:** P2-B04, P3-X01 · **Branch:** `b/P3-X04-deploy`

**Files:** create `apps/web/public/_redirects`, `tools/src/smoke.ts`, `apps/web/test/redirects.test.ts`; edit `docs/DEPLOY.md` (add the Pages section), `apps/web/package.json` (script `build`: `tsc --noEmit && vite build`), `tools/package.json` (script `smoke`).

**Spec:**

- `apps/web/public/_redirects` contains exactly `/* /index.html 200` so client-side routes work on Cloudflare Pages.
- `tools/src/smoke.ts` takes `API_URL` from the environment, calls `GET /api/health` and a `POST /api/scan` with a tiny valid base64 image (any 200 characters of base64) and prints PASS or FAIL per check and the elapsed milliseconds. **Run by a human.**
- `DEPLOY.md` Pages section (verify against Cloudflare's current docs): connect the GitHub repo; build command `pnpm install && pnpm --filter @sp/web build`; output directory `apps/web/dist`; environment variable `VITE_API_BASE` = the Worker URL; then set the Worker's `ALLOWED_ORIGIN` to the Pages URL and redeploy the Worker.

**Tests (write first):**

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
describe('pages redirects', () => {
  it('sends every path to index.html', () => {
    expect(
      readFileSync(fileURLToPath(new URL('../public/_redirects', import.meta.url)), 'utf8').trim(),
    ).toBe('/* /index.html 200');
  });
});
```

**Done when:** `pnpm check` and `pnpm --filter @sp/web build` are green.

**Human steps:** (1) deploy the Worker with the real secret and model; (2) create the Pages project; (3) set the two URLs as above; (4) `API_URL=<worker url> pnpm --filter @sp/tools smoke`; (5) open the Pages URL on **two real phones**, scan one dish and one label; (6) fix `ALLOWED_ORIGIN` if you see a CORS error; (7) **remove `ENABLE_SPIKE`** if it is still set. If the Worker fails because of the CPU limit, follow the Render section of `DEPLOY.md` and tell the team. **Commit:** `chore(deploy): pages redirects, smoke test and deploy runbook`

---

## P3-X05 Evaluation on real photos

**Track:** D with B · **Depends on:** P2-D05, P3-X04 · **Branch:** `d/P3-X05-eval-run`

**Human prerequisite:** the team's photos are in `eval/photos/` and `eval/manifest.json` lists them (format in `eval/README.md`). About 10 to 15 dish photos covering different dishes and lighting, 5 to 8 label photos, plus a few deliberately hard ones (blurry, mixed plate). Mark **about one third as `holdout`** and do not tune on them.

**Files:** create `tools/src/eval-run.ts`, `tools/test/eval-run.test.ts`; generated: `docs/EVAL_REPORT.md`.

**Spec:** `eval-run.ts` reads the manifest, calls the **deployed API** (`API_URL`), sends only `dev` items by default (`--holdout` runs the holdout once, at the end), respects `--max-calls` (default 25; stop and report when reached; the free AI quota is small), and writes `docs/EVAL_REPORT.md` with: counts, `dishMetrics` and `labelMetrics`, the list of failures (file, expected, got), the share of responses with `imageQuality: poor`, and median latency. It prints the report to the console as well. **Do not change prompts or thresholds in this card.**

**Tests (write first):** the pure `renderReport(metrics, failures): string` function: contains the headings `Dish recognition`, `Label reading`, `Failures`; formats rates as percentages with one decimal; never prints `NaN`. A second test that `parseArgs(['--max-calls','5'])` gives 5 and the default is 25.

**Done when:** green; humans run `eval-run` on `dev`, then (once) on `holdout`; paste the headline numbers in the report. **Commit:** `feat(tools): evaluation runner and report`

**Use the result:** if top-3 dish accuracy is poor, the confirm-dish screen is the safety net (it exists for this reason); if label reading is poor, say so honestly in the video and keep the label path as "beta". Prompt changes are a separate card by B, tested on `dev` only.

---

## P3-X06 Low confidence, errors, waking state and sample scans

**Track:** C · **Depends on:** P3-X01 · **Branch:** `c/P3-X06-resilience`

**Files:** create `apps/web/src/lib/useSlowNotice.ts`, `apps/web/src/components/SamplePicker.tsx`, `apps/web/src/lib/error-messages.ts`, `apps/web/test/use-slow-notice.test.tsx`, `error-messages.test.ts`, `sample-picker.test.tsx`; edit `src/pages/Scan.tsx`.

**Spec:**

- `useSlowNotice(loading: boolean, ms = 8000): boolean` becomes true after `ms` of continuous loading (the "Waking up the server, one moment" message); resets when loading stops.
- `errorKeyFor(code: string): string` maps `rate_limited` to `error.daily_limit` (with a pointer to the samples), `ai_unavailable` to `error.unavailable`, `ai_invalid_output` to `error.unreadable`, `too_large` to `error.too_large`, `bad_request` to `error.bad_request`, anything else to `error.generic`.
- `SamplePicker`: buttons "Try a sample: Kacchi Biryani / Mishti Doi (spoiled) / Label: snack / Unknown dish", each clearly marked "sample, no AI call", which runs `mockScan` fixtures through the same flow. Always visible on the Scan page so a judge can try the app with no camera and no quota.
- Add the new message keys to `ui-strings.ts` in both languages.

**Tests (write first):**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSlowNotice } from '../src/lib/useSlowNotice';
describe('useSlowNotice', () => {
  it('turns on after the delay and resets when loading stops', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ l }) => useSlowNotice(l, 8000), {
      initialProps: { l: true },
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(8001);
    });
    expect(result.current).toBe(true);
    rerender({ l: false });
    expect(result.current).toBe(false);
    vi.useRealTimers();
  });
});
```

```ts
import { describe, it, expect } from 'vitest';
import { errorKeyFor } from '../src/lib/error-messages';
describe('errorKeyFor', () => {
  it.each([
    ['rate_limited', 'error.daily_limit'],
    ['ai_unavailable', 'error.unavailable'],
    ['ai_invalid_output', 'error.unreadable'],
    ['too_large', 'error.too_large'],
    ['bad_request', 'error.bad_request'],
    ['weird', 'error.generic'],
  ])('%s', (c, k) => {
    expect(errorKeyFor(c)).toBe(k);
  });
});
```

`sample-picker.test.tsx` (real code): clicking each sample navigates to `/confirm` (dish samples) or `/result` (label), and the "no AI call" text is rendered; `fetch` is never called.

**Done when:** green. **Commit:** `feat(web): resilience states and offline sample scans`

---

## P3-X07 Responsive and accessibility pass

**Track:** C · **Depends on:** P3-X02 · **Branch:** `c/P3-X07-a11y`

**Files:** create `apps/web/src/lib/contrast.ts`, `apps/web/test/contrast.test.ts`, `apps/web/test/a11y.test.tsx`, `docs/QA_CHECKLIST.md`; edit components as needed to fix findings.

**Spec:** `contrastRatio(fg: string, bg: string): number` for 6-digit hex colours (WCAG formula). A test parses the token hex values from `index.css` (light and dark) and asserts text-on-background pairs are at least **4.5**, and each risk colour on the card background at least **3.0**.

**Tests (write first):**

```ts
import { describe, it, expect } from 'vitest';
import { contrastRatio } from '../src/lib/contrast';
describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colours', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });
  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBeCloseTo(contrastRatio('#fedcba', '#123456'), 5);
  });
});
```

`a11y.test.tsx` (real code): on the Result page every button and link has an accessible name; every `img` has `alt`; every form control in Onboarding is reachable with `getByLabelText`; level and status are conveyed in text. `docs/QA_CHECKLIST.md` is a manual list for a human with two phones: no horizontal scroll at 360 px width, tap targets at least 44 px, dark mode readable, Bangla text not clipped, camera permission denied shows a friendly message, rotating the phone keeps the layout.

**Done when:** green; the human runs the checklist and notes failures as bug cards. **Commit:** `feat(web): contrast check, accessibility tests and qa checklist`

---

## P3-X08 Data freeze

**Track:** D · **Depends on:** P2-D06 · **Branch:** `d/P3-X08-freeze`

**Files:** create `packages/knowledge/test/runtime-sync.test.ts`, `packages/knowledge/data/FREEZE.md`; regenerate the data files with the tools (`normalize`, `apply-approved`, `merge-rules`, `demo-gate`); edit `tools/src/normalize-data.ts` only if the test below needs an exported builder (for example `buildRuntime()`).

**Spec:** `FREEZE.md` records the date, the counts (dishes, ingredients, rules by status), the coverage gate list, and the open items (draft rules, unreviewed quantities). A test regenerates the runtime file **in memory** from the normalized files and fails if the committed `runtime.json` differs, so nobody forgets to regenerate.

**Tests (write first):**

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { buildRuntime } from '../src/runtime';
describe('runtime export', () => {
  it('matches the committed file', () => {
    const committed = JSON.parse(
      readFileSync(fileURLToPath(new URL('../data/runtime/runtime.json', import.meta.url)), 'utf8'),
    );
    expect(buildRuntime()).toEqual(committed);
  });
});
```

(Move the runtime-building logic from `tools/src/normalize-data.ts` into `packages/knowledge/src/runtime.ts` as `buildRuntime()`; the tool calls it.)

**Done when:** green; `FREEZE.md` committed. **Commit:** `chore(knowledge): freeze data and guard runtime export`
