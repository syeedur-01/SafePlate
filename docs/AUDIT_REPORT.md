# SafePlate — Complete Project State Audit

**Audit date:** 2026-11-18
**HEAD:** `2d51bb3` on `main` · **Working tree:** clean (verified)
**Auditor:** senior AI/ML engineer + full-stack architect + quality auditor (investigation only — no files modified)

**Direct verification performed:** `pnpm check` (typecheck + eslint + prettier + tests) → **exit 0, fully green**; per-package test run → **84 test files, 791 tests, all passing**. Everything marked VERIFIED was read from source; DOCUMENTED-ONLY / PLANNED items are flagged as such.

Status labels used: IMPLEMENTED AND VERIFIED · IMPLEMENTED BUT NOT VERIFIED · PARTIALLY IMPLEMENTED · MOCK / PLACEHOLDER · NOT IMPLEMENTED · NEEDS INVESTIGATION

---

## 1. Executive Summary

SafePlate is a **pnpm monorepo** (TypeScript strict, Vitest, Hono API on Cloudflare Workers, Vite+React web) implementing a bilingual (EN/BN) food-safety scanner. The core architectural promise — **"AI perceives, deterministic code decides"** — is genuinely implemented and well-enforced: the Gemini vision call only identifies dishes/transcribes labels; all scoring, nutrition, warnings and swaps run in a pure, tested engine (`packages/engine`) against a curated, source-cited knowledge base.

**Strengths (verified):**

- Privacy is real, not cosmetic: the health profile lives in `localStorage` only, the scan request schema is `.strict()` and rejects profile fields (`packages/contracts/src/api.ts:14-22`), analysis runs client-side, and a dedicated privacy-scan test asserts the server never references profile data.
- Nutrition can never be invented: missing data → `null`, never `0` or an LLM number; `estimated: true` is a `z.literal(true)` that cannot be hidden (`packages/contracts/src/analysis.ts:24`).
- 791 passing tests including a golden test over all 30 real dishes, WCAG contrast math, and an i18n key-coverage test. `pnpm verify` gates data/rule/message/source consistency in CI.

**Critical weaknesses (verified):**

1. **The production cache is not wired up** — `MemoryScanCache` exists and is tested, but neither `apps/api/src/worker.ts` nor `node.ts` sets `config.cache`, so every production scan hits Gemini until the 200/day budget is exhausted. Cache and budget also reset on every Worker restart (in-memory only).
2. **The deployed model name `gemini-3.5-flash-lite`** (`apps/api/wrangler.toml:10`) **does not correspond to any publicly known Gemini model** — the live deployment may be broken or silently failing.
3. **Data coverage is thin**: 30 dishes / 56 ingredients; 21 ingredients are unsourced (`*-unverified`); `sat_fat_g` and `sugars_g` are **100% null**; every dish quantity is an unreviewed `ESTIMATE`; only 1 of 30 dishes has lab values; "expert review" was performed by an AI standing in for a nutritionist (disclosed in `P2-DH01-approval-record.md`).
4. **The evaluation loop never ran on real images**: no real photos, no committed `eval/manifest.json`, no `docs/EVAL_REPORT.md` — recognition accuracy is **unmeasured**.
5. Plan bookkeeping is stale: the status board in `docs/plan/00_INDEX_AND_WORKFLOW.md:93-157` still marks every card "todo" despite 74 merged PRs; P4-X04 (performance) and P4-X05 (README, KNOWN_LIMITATIONS, `mvp-demo` tag) were never done; there is **no README**.

**Overall verdict:** a well-engineered, honestly-labeled MVP skeleton with excellent test discipline and privacy design, but with **operational risks in production configuration, an unvalidated recognition model, and a knowledge base too small to be broadly useful**.

---

## 2. Current Architecture

VERIFIED (matches `docs/TECH_DESIGN.md` closely):

| Layer | Package | Role |
|---|---|---|
| Contracts | `packages/contracts` | Zod schemas (.strict() for API), types, test builders (`makeDish`/`makeIngredient`/`makeProfile`) |
| Engine | `packages/engine` | Pure functions: nutrition, safety scoring, suitability, swaps, shopping, label analysis. No clock/IO — `today` is injected |
| AI | `packages/ai` | `VisionProvider` interface (`packages/ai/src/provider.ts:12-15`), `GeminiProvider` (raw REST, no SDK), `MockProvider`, prompt builders, JSON repair/parse, cache, daily budget |
| API | `apps/api` | Hono; Worker entry (`worker.ts`, bundles `normalized/dishes.json` at build time) + Node entry (`node.ts`); routes: `GET /api/health`, `POST /api/scan` |
| Web | `apps/web` | Vite+React+Tailwind; **runs the engine in the browser** with bundled runtime JSON |
| Knowledge | `packages/knowledge` | Loaders (Zod-validated) over source→normalized→runtime data, rules, messages, allergen keywords, sources |
| Tools | `tools` | fetch/match/apply/normalize/demo-gate/coverage/merge/eval/verify/smoke scripts |

**Key design decision:** `POST /api/scan` returns only an identification (candidates + observations). The personalized analysis (`analyze()` from `@sp/engine`) executes **on the client** (`apps/web/src/state/useAnalysis.ts:85-118`), which is what keeps the profile off the network. The API package has no analyze route (verified: `apps/api/src/app.ts` registers only `/api/scan`, `/api/health`, and a spike route).

**Data pipeline (VERIFIED):**
`data/raw/` (FCTB-2013 PDF, USDA FDC CSVs, gitignored) → match scripts write **proposals** → human sets `approvedFoodCode`/`approvedFdcId` fields by hand → `apply-approved.ts` applies → `normalize-data.ts` regenerates `data/normalized/` + `data/runtime/` → a drift-guard test fails if committed `runtime.json` is stale.

---

## 3. Existing Features and Implementation Status

| Feature | Status | Evidence |
|---|---|---|
| Dish photo scan → candidates | IMPLEMENTED AND VERIFIED | `packages/ai/src/prompts.ts:8-26`, `runScan` |
| Packaged-label scan (OCR mode) | IMPLEMENTED AND VERIFIED | `buildLabelPrompt` (`prompts.ts:29-41`) |
| Client-side downscale to ≤1024px JPEG | IMPLEMENTED AND VERIFIED | `apps/web/src/lib/downscale.ts` |
| Candidate confirm/correction UI + "None of these" | IMPLEMENTED AND VERIFIED | `apps/web/src/pages/Confirm.tsx` |
| Deterministic safety score w/ evidence links | IMPLEMENTED AND VERIFIED | `packages/engine/src/safety.ts:54-92` |
| Spoilage-sign detection (8 signs) | IMPLEMENTED BUT NOT VERIFIED (LLM visual judgment, unmeasured accuracy) | `SPOILAGE_SIGNS` in `packages/contracts/src/vocab.ts:30-41` |
| Allergen keyword matching (EN + Bangla script + romanized) | IMPLEMENTED AND VERIFIED (known false-positive risks) | `packages/engine/src/label.ts:16-66` |
| "May contain"/trace advisories | **NOT IMPLEMENTED** | No code or data anywhere |
| Storage-duration (`storage_hours`) safety rules | PARTIALLY IMPLEMENTED — trigger type exists in engine, **no rule data**, and the UI always sends `storage: 'unknown'` so it can never fire | `packages/engine/src/safety.ts:29-37`; `apps/web/src/state/useAnalysis.ts:59-63` |
| Nutrition card w/ coverage gate (0.8) | IMPLEMENTED AND VERIFIED | `packages/engine/src/nutrition.ts` |
| Swaps + shopping list | IMPLEMENTED AND VERIFIED | `packages/engine` + web tabs |
| Bilingual UI (45 message keys, en+bn) | IMPLEMENTED AND VERIFIED | `packages/knowledge/data/messages.json`, key-coverage test |
| Offline demo/sample scans (no AI call) | IMPLEMENTED AND VERIFIED | `apps/web/src/components/SamplePicker.tsx`, `/demo` scenarios |
| AI response caching | MOCK / PLACEHOLDER in production — implemented + tested, **never wired into `worker.ts`/`node.ts`** | `packages/ai/src/cache.ts` |
| Eval runner + metrics | IMPLEMENTED BUT NEVER RUN on real data (`eval/` has only README + example manifest; runner targets the deployed API) | `tools/src/eval-run.ts` |
| Daily AI budget guard | IMPLEMENTED AND VERIFIED (200/day, in-memory, resets on restart) | `packages/ai/src/budget.ts` |
| On-device/local AI inference | NOT IMPLEMENTED (Phase-5 idea only) | — |
| E2E browser tests | NOT IMPLEMENTED (only jsdom component + in-process contract-integration tests) | — |

**Plan status (verified via git log, 74 merged PRs):**

- Phases 0–3 fully done.
- Phase 4: X01–X03 done; **P4-X04 (perf/size budget) and P4-X05 (README, KNOWN_LIMITATIONS, `mvp-demo` tag) NOT done** — no README.md, no KNOWN_LIMITATIONS.md, no git tags exist.
- Phase 5 is outline-only by design.
- Missing artifacts promised by completed cards: `docs/EVAL_REPORT.md`, filled `docs/SPIKE_RESULTS.md`, filled `docs/TEAM.md`; `docs/BUGS.md` still shows BUG-01 "in progress" though it was fixed (`2d51bb3`).

---

## 4. AI Recognition Pipeline Analysis

End-to-end trace, all VERIFIED:

1. **Upload** — `apps/web/src/pages/Scan.tsx:126-132`: `<input type="file" accept="image/*" capture="environment">`. **No client-side MIME/size validation** — oversized/corrupt files fail later as generic errors.
2. **Preprocess** — `downscaleToJpeg` (`apps/web/src/lib/downscale.ts:39`): ≤1024px JPEG q0.8 + 160px thumbnail. Server does **no** preprocessing; base64 goes straight to the model (`packages/ai/src/gemini-provider.ts:66`).
3. **Transport** — POST JSON `{kind, imageBase64, mimeType, context}` to `/api/scan`, 30s AbortController (`apps/web/src/api/client.ts`). Client validates with `ScanRequestSchema.parse` before sending.
4. **API validation** — CORS locked to `ALLOWED_ORIGIN` (`apps/api/src/app.ts:13-18`); body ≤2MB → 413; `.strict()` zod schemas; MIME enum jpeg/png/webp. **Limitation:** no magic-byte sniffing — the server trusts the client-declared `mimeType`.
5. **Provider selection** — `apps/api/src/provider.ts:5-20`: `AI_PROVIDER` env; **`mock` is the default when unset**; `gemini` throws at startup if `GEMINI_API_KEY`/`GEMINI_MODEL` missing (no fallback). Deployed model name `gemini-3.5-flash-lite` is not a known public model — **NEEDS INVESTIGATION / likely broken deploy**.
6. **Prompt** — the **entire 30-dish catalogue (ids + English names + aliases) is embedded in every dish prompt** with no truncation (fine at 30 dishes; a scaling concern later). Model must return `dishId` from the list **or null**; ≤3 candidates sorted by confidence; `spoilageSigns` restricted to the 8-value enum; "Give no health or safety advice". Label prompt demands null for unreadable fields, "Never guess a value".
7. **Response handling** — `parseModelJson` (`packages/ai/src/parse.ts:4-22`) tries raw / code-fence-stripped / brace-sliced; zod-validated; up to **2 attempts, but only for invalid output — network/provider errors are never retried**, and there is no fallback provider (`packages/ai/src/run-scan.ts:6-29`).
8. **Unknown-dish handling** — explicit and safe: `dishId: null` allowed by prompt; `sanitize()` nulls any hallucinated id not in the catalogue; `Confirm.tsx` treats `null` or confidence < 0.5 as "unsure" and offers catalogue search. Unknown dish → nutrition `null`, photo-visible safety only.
9. **Caching** — `MemoryScanCache`, SHA-256 key over kind+mime+image, TTL 24h — **wired only in tests**; production Worker/Node never set `config.cache`.
10. **Errors** — mapped cleanly to `429/502/500` codes; messages never echo internals; label results pass through `sanitizeLabelResult` (implausible expiry dates nulled, ingredients text capped at 2000 chars, `apps/api/src/sanitize.ts:9-18`).

**Confidence:** taken as-is from the model (clamped only by the 0–1 zod range); used internally by `Confirm.tsx` but **never displayed to the user**.

**Can it recognize dishes outside the database? No, by design** — the model is constrained to the 30-dish catalogue and the engine throws on a truly unknown `dishId` (`packages/engine/src/analyze.ts:66`); that throw is unreachable from the web flow.

**Secrets check:** no hardcoded keys anywhere. `.env.example` key names: `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `ALLOWED_ORIGIN`. `.env` is gitignored. Wrangler keeps the key as a secret, not a `[vars]` entry.

**AI unit tests:** 8 files in `packages/ai/test/` covering parse, prompts, run-scan, gemini provider (fetch-faked), mock provider, cache, budget — no test hits a real AI or network.

---

## 5. Nutrition and Knowledge System Analysis

**Counts (VERIFIED via scripted counts):**

| Item | Value |
|---|---|
| Dishes | **30** (`packages/knowledge/data/source/dishes.json`), 238 composition lines (3–13 per dish) |
| Dish quantities | all `quantity_basis: "ESTIMATE"`, all `serving_weight_basis: "ESTIMATE"`, all `needs_expert_review: true`; confidence 29×`low`, 1×`medium` |
| Lab values | only 1 dish (`bangladeshi-chicken-roast`) has `lab_values_per_serving` |
| Ingredients | **56** (`source/ingredients.json`), per-100g raw |
| Ingredient nulls | energy 24/56 null, protein 25, fat 24, carbs 25, sodium 39; **`sat_fat_g` and `sugars_g` 56/56 null** |
| Unsourced ingredients | **21** (`*-unverified` ids) |
| Rules | 10 safety + 4 health (all `approved`) |
| Messages | 45 keys, every entry with both `en` and `bn` |
| Allergens | 10 canonical allergens; ~250+ keywords (English + Bangla script + romanized) |
| Sources | 10 entries (8 verified, 2 unverified; verified by content-matching fetch in `tools/src/check-sources.ts`) |
| Demo gate | 29/30 dishes pass the 0.8 energy-coverage gate (`shutki-bhorta` fails) |

**Three-state distinction — VERIFIED and clean:**

1. **Verified/derived nutrition** — `computeNutrition()` (`packages/engine/src/nutrition.ts:6`) scales per-100g values by raw grams, computes coverage, gates display at `MIN_COVERAGE = 0.8`; per-value provenance stored (`source_id`, `pdf_page`, `food_code`) — citations genuinely exist at the nutrient level.
2. **AI/estimated** — the LLM transcribes label `nutritionPer100g`, but that is used **only** to evaluate health-rule warnings, never shown as computed nutrition (`packages/engine/src/label.ts:69-110`). `origin` enum has no "AI" value; `estimated: z.literal(true)` is un-hideable.
3. **Unavailable** — unknown dish or uncovered nutrient → `null` with `origin: 'none'` and "not enough data" UI; missing values produce `warn.insufficient_data`, never zero.

**No code path fabricates nutrition.** Residual caveats:

- (a) label-transcribed numbers are real OCR but unverified against any dataset;
- (b) every dish quantity is an unreviewed estimate, so "calculated" totals rest on guesswork — honestly labeled;
- (c) approval records disclose the "expert review" was performed by an external AI as a nutritionist stand-in (documented in `packages/knowledge/data/proposals/P2-DH01-approval-record.md`).

**Gaps:** no license/attribution field on any source entry; human-approval gating exists in tooling (`apply-approved.ts:34-110` throws unless `approved*` fields are hand-set) but the approval provenance is AI-assisted.

---

## 6. Food Safety and Allergen Analysis

- **Spoilage detection — IMPLEMENTED BUT NOT VERIFIED:** 8 enum-constrained signs (`visible_mold`, `slimy_surface`, `discoloration`, `bloated_packaging`, `leaking_packaging`, `separated_liquid`, `foam_or_bubbles`, `foreign_object`) reported by the Gemini vision model (temperature 0.1, JSON mode), each mapping to a 30–40-point safety rule with evidence text and sourceRef. Mitigations: enum constraint, poor-image notice, always-on `notice.chemical_limit` disclaimer. **No per-sign confidence; accuracy unmeasured** (no eval images exist).
- **Safety score — VERIFIED deterministic:** `scoreSafety` (`packages/engine/src/safety.ts:54-92`) sums triggered rule points, capped at 100; every signal carries evidence + source; `today` injected (no clock reads). However, rule *points are team heuristics* and Codex clause citations were only "plausibility-checked" per the proposals file — the substance of the rules is not expert-validated.
- **Allergen matching — VERIFIED with real reliability risks:** whole-token consecutive matching over Unicode-tokenized text (`packages/engine/src/label.ts:16-31`), Bangla combining marks handled correctly. Risks:
  - `wheat_gluten` keywords include bare `flour`/`bread`/`biscuit` → **false positives on rice/chickpea flour**;
  - `milk` includes dish names (`kheer`, `payesh`);
  - `tree_nuts` includes bare Bangla `বাদাম` (generic "nut");
  - no stemming, so unlisted Bangla inflections fail;
  - mis-OCR silently yields false negatives.
- **Declared allergens** — from the label prompt enum; merged with keyword hits (declared wins). **"May contain"/advisory traces: NOT IMPLEMENTED.**
- **Storage rules — PARTIAL:** `storage_hours` trigger implemented in engine but **zero rules exist** (proposals note: "no opened source states an explicit hour limit"), and the UI always sends `storage: 'unknown'`, so this feature is dead code in the live app.
- **Health warnings — VERIFIED:** 4 approved rules (diabetes/hypertension sodium limits, 2 fried-food tag rules); thresholds cite Bangladesh National Dietary Guidelines 2025 but the caution/avoid fractions are disclosed heuristics; no sugar rule.
- **Explanations/disclaimers — VERIFIED:** 45 bilingual message keys; disclaimers always appended; About page explains estimated/draft semantics.
- **Health profile — VERIFIED device-only:** `LocalProfileStore` persists to `localStorage` (`sp.profile.v1`); suitability computed by `evaluateSuitability` (`packages/engine/src/suitability.ts:13-83`); server never receives the profile; privacy-scan test enforces this.

---

## 7. Frontend and User Experience Analysis

Routes (`apps/web/src/App.tsx:62-80`): `/welcome`, `/`, `/confirm`, `/result`, `/history`, `/settings`, `/about`, `/demo`.
Journey: upload → context chips (place/storage/hours) → Analyze → Confirm (best guess / search / "None of these") → Result with 4 tabs (Safety, For-you, Nutrition, Swap).

**Working well (VERIFIED):**

- bilingual strings via `t()` with no hardcoded UI text;
- 44px touch targets; WCAG contrast asserted by tests in both palettes;
- aria roles, `role="alert"`/`role="status"`, reduced-motion gauge;
- status badges for estimated/draft; coverage-gated nutrition display;
- offline SamplePicker + `/demo` scenarios through the real engine;
- strong component + state test coverage (127 web tests);
- health profile stored in localStorage only; "delete my data" in Settings.

**UX problems (all VERIFIED in code):**

1. **Refresh dead-end** — `/result` and `/confirm` depend entirely on router state; refresh silently redirects home (`apps/web/src/pages/Result.tsx:174-176`).
2. **History is a dead end** — entries are static list items, not clickable; past scans can't be reopened.
3. **No 404 route** — unknown URLs render a blank main area.
4. **Confidence never shown** to the user.
5. **"None of these" is opaque** — silently downgrades to label-kind analysis with less information, unexplained.
6. **No cancel/upload-progress** during the 30s analysis; only a slow notice after 8s.
7. **No client-side file-size check** — huge files fail late with a generic error instead of "too large".
8. Triplicated language controls (header, Settings, Onboarding).
9. Onboarding-gate redirect: a first-time visitor deep-linking anywhere lands on `/welcome`.

---

## 8. Dataset and Recognition Coverage

| Question | Finding |
|---|---|
| Approved nutrition dishes | **30** (238 composition lines) — VERIFIED |
| Ingredients | **56** (21 unsourced; sat_fat/sugars 100% null) — VERIFIED |
| Recognition categories/aliases | Same 30 dishes; aliases live in `dishes.json` and are injected into the prompt — **recognition and nutrition sets are the same list, not separated** — VERIFIED |
| External datasets integrated | FCTB-2013, USDA FDC (sr-legacy + foundation foods) fetched to `data/raw/` and matched via proposals; 3 IFCT gap entries; ~31 FCTB + 25 USDA approvals applied — VERIFIED |
| Image evaluation data | **None.** `eval/` = README + example manifest only; `fixtures/mock-scan/` = 6 synthetic JSON, no photos — VERIFIED |
| License documentation | **Absent** — `sources.json` has tier/status/accessedOn but no license fields — VERIFIED |
| Runner usability | `tools/src/eval-run.ts` targets the **deployed API** with `API_URL`; never demonstrably run (no report committed) — VERIFIED |

---

## 9. Testing and Reliability Assessment

**Run by auditor: `pnpm check` → green (exit 0). `pnpm -r test` → all passing:**

| Package | Files | Tests |
|---|---|---|
| contracts | 5 | 31 |
| ai | 8 | 26 |
| knowledge | 8 | 41 |
| engine | 11 | **447** (incl. golden test over all 30 real dishes) |
| tools | 10 | 79 |
| api | 11 | 40 (incl. e2e + privacy scan) |
| web | 31 | 127 |
| **Total** | **84** | **791** |

**Strengths:** no test touches network or real AI (all providers inject `fetchFn`); builders from `@sp/contracts/testing`; a runtime-data drift guard; WCAG contrast tests; an i18n key-coverage test; contract-integration test wiring the web client against the in-process API.

**Missing critical tests / gaps:**

- **No coverage measurement configured** anywhere (no `@vitest/coverage-*`).
- **No browser E2E** (Playwright etc.); routing bugs like BUG-01 only became visible at runtime.
- **Untested AI recognition behavior** — model accuracy, prompt drift, spoilage-sign precision/recall, label OCR quality are all unmeasured; the eval harness exists but has no data and no committed report.
- No tests for the production wiring gap (cache) because only tests construct `config.cache`.
- `pnpm verify` (data/rules/messages/source-ref consistency) runs in CI and passes, but source *liveness* checking is a separate, manual script.

---

## 10. Technical Debt and Identified Problems

1. **P0 — Production cache not wired** (`apps/api/src/worker.ts`, `apps/api/src/node.ts`): tested feature dead in prod; every scan bills the budget; cache+budget evaporate on restart.
2. **P0 — Deployed model name likely invalid** (`gemini-3.5-flash-lite`, `apps/api/wrangler.toml:10`) — needs confirmation against the actual Gemini API.
3. **P1 — `AI_PROVIDER` defaults to `mock`** when unset: any environment that forgets the var silently serves fixture scans.
4. **P1 — Recognition accuracy unmeasured**: no real images, no eval run, no report.
5. **P1 — Knowledge base too thin for real use**: 30 dishes, 21/56 ingredients unsourced, sat_fat/sugars absent, all quantities unreviewed estimates, AI stand-in review.
6. **P2 — Dead feature paths**: storage rules; spike route disabled by default (fine, but adds surface).
7. **P2 — Provider retry gap**: network errors not retried; no fallback provider.
8. **P2 — Frontend dead ends**: refresh, history, 404.
9. **P3 — Docs rot**: stale status board, BUGS.md, TEAM.md, SPIKE_RESULTS.md; missing README/KNOWN_LIMITATIONS/EVAL_REPORT; no git tags; no source licenses.
10. **P3 — Prompt embeds full catalogue** with no truncation — a scaling hazard as dishes grow.

---

## 11. Missing Features and Product Gaps

- "May contain"/trace-advisory handling; sugar/added-sugar health rules; storage-duration rules end-to-end.
- Confidence display and candidate-quality transparency in UI.
- Reopenable history, 404 page, cancel/progress during analysis, client-side size checks.
- Local/on-device fallback inference (planned Phase 5, nothing exists).
- Durable cache/budget (KV) for multi-instance correctness.
- Dataset licensing/attribution; real expert (human) review of rules and quantities.
- Coverage measurement and browser E2E.

---

## 12. Recommended Improvement Priorities

**Phase A — Make production trustworthy (blockers)**

1. Fix/confirm `GEMINI_MODEL` against a real, vision-capable model; add a startup health probe that fails loudly on an invalid model.
2. Wire the existing `MemoryScanCache` (or Cloudflare KV) and budget into `worker.ts`/`node.ts`; add a test asserting the production entries construct them.
3. Default `AI_PROVIDER` to fail-fast (require explicit selection) instead of silently mocking.
4. Add retries/backoff for transient network errors, or an explicit second-provider fallback.

**Phase B — Validate the AI (the biggest unknown)**

5. Build a real image eval set (even 30–50 photos of the 30 dishes + 10 labels), run `tools/src/eval-run.ts`, commit `docs/EVAL_REPORT.md`; track top-1/top-3 and spoilage precision/recall.
6. Decide the scale strategy for the embedded dish catalogue (truncate/bucket by cuisine) before adding dishes.

**Phase C — Deepen the knowledge base**

7. Source the 21 unsourced ingredients; add sat_fat/sugars from FCTB/USDA; convert quantities from ESTIMATE to reviewed values with a real nutritionist; add license fields to `sources.json`.
8. Implement "may contain" parsing and a sugar health rule; either implement storage rules end-to-end (UI already collects hours) or remove the dead trigger.

**Phase D — UX and hardening**

9. Persist scan results (history-based recovery for `/result`/`/confirm`), clickable history, 404 route, confidence display, client-side size validation.
10. Add vitest coverage reporting and a minimal Playwright smoke test; refresh stale docs, add README + KNOWN_LIMITATIONS, tag `mvp-demo` (completing P4-X04/X05).

---

*Audit method: read-only investigation (git status/log, source and data inspection, scripted data counts, existing `pnpm check` and test suites). No project files were modified, no packages installed, no network AI calls made.*
