# SafePlate v2.0.0 Progress

Updated: 2026-11-19
Branch: `improvement/development`
Baseline tag: `v1.0.0` (remote tag → `a377f77`; local tag → `a38d74e` — see notes)
Governing spec: `SAFEPLATE_V2_IMPROVEMENT_PLAN.md` (repo root)

| Phase | Status      | Commit                                      | Checks                                                                             | Notes / blockers                                                                                       |
| ----- | ----------- | ------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0     | Complete    | `fc6b771` + Phase 0 commit                  | `pnpm check` exit 0 (793 tests), `pnpm verify` 0 problems, web build within budget | Tag discrepancy documented below                                                                       |
| 1     | Complete    | `a60066d`                                   | `pnpm check` green at commit                                                       | Honest doc status banners; status board reconciled; README cache claim corrected                       |
| 2     | Complete    | `6dd7c5c`                                   | `pnpm check` exit 0 (86 files / 815 tests), `pnpm verify` 0 problems               | KV binding + global budget enforcement remain approval-gated (see docs/PRODUCTION_RELIABILITY.md)      |
| 3     | Complete    | `1396571` + `e5d14a4` + `0c53fa7`           | `pnpm check` exit 0, `pnpm verify` 0 problems                                      | Real Gemini run deferred to Phase 4 (spend gate); dataset + approved mappings + harness in place       |
| 4     | Complete    | `7973d46` + `fb7daeb` + Phase 4 docs commit | Local run executed and documented (see notes)                                      | Gemini column spend-gated; recommendation option (a): cloud Gemini stays production primary            |
| 5     | Complete    | `20d4d6a`                                   | `pnpm check` exit 0, `pnpm verify` 0 problems                                      | Recognition catalogue (46 entries) separate from nutrition; identified-unsupported UI state; see notes |
| 6     | Complete    | `eead3f8`                                   | `pnpm check` exit 0, `pnpm verify` 0 problems                                      | Nutrient-level provenance + honest review statuses; remaining gaps queued for human review; see notes  |
| 7     | Not started |                                             |                                                                                    |                                                                                                        |
| 8     | Not started |                                             |                                                                                    |                                                                                                        |
| 9     | Not started |                                             |                                                                                    |                                                                                                        |
| 10    | Not started |                                             |                                                                                    | STOP: requires explicit user approval (release/deploy gate)                                            |

## Current phase

Phase 6 — nutrition knowledge provenance (implementation complete; human-review queue generated, no values invented).

## Baseline (recorded 2026-11-18, commit `fc6b771`)

| Check                 | Command                       | Result                                                                                                               |
| --------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Full suite            | `pnpm check`                  | exit 0 — 85 test files, 793 tests passing (contracts 31, ai 26, knowledge 41, engine 447, tools 79, api 40, web 129) |
| Data verification     | `pnpm verify`                 | 30 dishes, 56 ingredients, 14 approved rules, 45 messages, 10 sources → 0 problems                                   |
| Web production build  | `pnpm --filter @sp/web build` | success; JS 193,610 B gzip + CSS 3,810 B gzip = 197,420 B ≤ budget 212,972 B                                         |
| Pre-existing failures | —                             | none found at baseline                                                                                               |

## Completed work

- Phase 0: verified branch/tag/remote safety; merged `origin/main` (P4-X04, P4-X05, merged audit report PR #77) into `improvement/development` (merge `fc6b771`, one add/add conflict in `docs/AUDIT_REPORT.md` resolved with the prettier-formatted merged version); formatted `SAFEPLATE_V2_IMPROVEMENT_PLAN.md`; recorded baseline.
- Phase 1 (`a60066d`): status board reconciled with Git history; `TEAM.md` / `SPIKE_RESULTS.md` given honest status banners; `docs/EVAL_REPORT.md` replaced with an honest "no measured results yet" stub; README corrected (cache claim scoped to tests/local until Phase 2) and env-var table added.
- Phase 2 (`6dd7c5c`):
  - Fail-fast provider selection in `apps/api/src/provider.ts` — missing `AI_PROVIDER` is a boot error, never a silent mock; `node.ts` boots fail-fast; the Worker builds the provider tolerantly so `/api/health` (process health) stays up while `/api/scan` answers 503 (config health).
  - Worker keeps one app per isolate keyed on the env signature, so the budget guard and cache persist across requests instead of being recreated per request (audit finding fixed).
  - `packages/ai/src/cache.ts`: versioned cache keys (`SCAN_CACHE_VERSION` + provider + model + kind + MIME + image hash) and a `KvScanCache` adapter with schema-validated reads and a 60 s TTL floor; the Node entry uses `MemoryScanCache`, the Worker uses KV when the `SCAN_CACHE_KV` binding exists (provisioning is an approval gate; `wrangler.toml` carries a commented block).
  - `GeminiProvider`: bounded retries (default 3 attempts) with exponential backoff, jitter and `Retry-After`; non-retryable 4xx errors stop after one attempt (a loop bug found by the new tests).
  - Magic-byte upload validation (`apps/api/src/image-signature.ts`) rejects image bytes that do not match the declared MIME type with 400; the scan page adds client-side type and 10 MB size checks with bilingual messages, and hides the Retry button when no scan has run.
  - `/api/health` reports `provider`, `providerConfigured`, `cache` kind and `budgetScope: 'in-memory'`.
  - New `docs/PRODUCTION_RELIABILITY.md` documents what is guaranteed and what still needs approved work (KV provisioning, globally atomic budget via Durable Objects).
  - Test counts after Phase 2: 86 files / 815 tests (contracts 31, ai 37, knowledge 41, engine 447, tools 79, api 49, web 131).
- Phase 3 (`1396571` + `e5d14a4` + `0c53fa7`): licence audit gate in `docs/EVAL_DATASETS.md`; BD-Food33 (CC0 1.0) downloaded into gitignored `eval/datasets/` with SHA-256 verification after user approval; manifest of 1,211 images (17 exact duplicates marked unused, deterministic ~80/20 dev/holdout split) with 8 user-approved label mappings → 263 scorable images; evaluation harness (`tools/src/eval-run.ts`, `eval-build-manifest`, `eval-metrics`, `eval-dedup`) validated offline.
- Phase 4 (`7973d46` + `fb7daeb` + docs commit):
  - Hardware audited (RTX 4060 8 GB VRAM, 24 GB RAM); candidates licence-verified (Qwen2.5-VL-3B Apache 2.0 primary, Gemma 3 4B secondary documented but not run).
  - `OllamaProvider` added in `packages/ai` behind the existing `VisionProvider` interface: `/api/chat` with `format:'json'`, same `buildDishPrompt`/`parseModelJson` path as Gemini, sanitized error mapping. Wired nowhere in production; reachable only via `EVAL_PROVIDER=ollama` in the eval harness.
  - `--pace-ms` added to `eval-run` for free-tier-paced runs (~13 RPM).
  - `docs/MODEL_COMPARISON.md` records the audit, method, both run commands and results.
  - **Local run executed 2026-11-18** (`qwen2.5vl:3b`, 100% GPU, 200 dev images): top-1 **44.5%**, top-3 64.0%, unknown rate 0.5%, macro-F1 0.244, median latency 3,763 ms, 3/200 call failures. Confident-wrong failure profile (near-zero unknown rejection); dhakaiya-bakarkhani recall 0.00, rasmalai recall 0.04, chicken-roast F1 0.98.
  - **Recommendation: option (a)** — cloud Gemini remains production primary; the local model is suitable for offline/local evaluation only (option b noted as a limited secondary finding); no separately hosted pilot proposed. Cloudflare production unchanged. **User accepted this decision on 2026-11-18** and directed that future accuracy work target the Gemini path (prompts, candidate preselection, preprocessing), measured on the benchmark.
  - Gemini benchmark column remains spend-gated (no paid call made, per the user's keep-it-free instruction); the exact command is recorded in `docs/MODEL_COMPARISON.md` §4.
- Phase 5 (`20d4d6a`):
  - New recognition catalogue `packages/knowledge/data/catalogue/catalogue.json` (version 1, 46 entries: 30 linked to approved nutrition dishes, 16 catalogue-only seeded from unambiguous BD-Food33 labels) with per-entry provenance and stable slug ids; `nutrition_dish_id` is the only link into the nutrition set.
  - Contracts: additive `CatalogueEntrySchema` / `CatalogueFileSchema`; no scan-response or analysis schema change (analysis already permits dishId non-null + nutrition null).
  - `packages/ai`: `ProviderContext.dishes` renamed to `catalogue`; the dish prompt now lists id, Bangla name, category and aliases from the catalogue; `sanitize` accepts any catalogue id, so a recognized-but-unsupported dish reaches the UI instead of being nulled to unknown.
  - API composition roots (Node, Worker, eval harness) now feed the catalogue; the Worker bundles `catalogue.json` instead of the dishes file.
  - Engine unchanged: `analyze` still throws for a dish id outside the approved nutrition set — the guard that keeps unapproved catalogue items out of deterministic nutrition/safety scoring.
  - Web: Confirm offers the full catalogue; Result shows a distinct "Dish identified / no reviewed nutrition or safety data" state (bilingual) for catalogue-only dishes, with no score, no nutrition card, and no history entry.
  - Data pipeline incident caught by tests: a plain `normalize` run reverted `data/normalized/ingredients.json` approved values (it is written by `apply-approved`, which must run after `normalize`); restored from Git and re-ran `apply-approved`; `pnpm verify` and engine sodium-anchor tests confirm data integrity.
- Phase 6 (2026-11-19):
  - Contracts (additive): `ProvenanceSchema` (registered or mapped source id plus record locator — food code, FDC id, PDF page, table, row name, description, basis, preparation; detail fields may be `null` when explicitly absent); `review_provenance` enum (`source_verified` / `ai_assisted_review` / `human_review_pending` / `human_reviewed`) added to ingredients and dishes; `SourceEntrySchema` gains optional `doi`, `licence`, `version`.
  - Derivation (`tools/src/review-provenance.ts`): an ingredient is `source_verified` only when at least one value is present and every present value carries a per-nutrient source entry, otherwise `human_review_pending`; every dish is `ai_assisted_review` per the P2-DH01 approval record (AI-assisted stand-in panel, owner accepted, no human nutritionist involved) — never claimed as human expert review. Wired into `normalize` and `apply-approved`; normalized data re-generated in the documented pipeline order (normalize → apply-approved); no nutrient value changed (verified by diff).
  - `verify` hardened: provenance source ids must resolve to the sources register directly or via the mapped provenance vocabulary (FCTB-2013/USDA-FDC/IFCT-2017); every present nutrient value must have a `nutrient_sources` entry; missing `review_provenance` is a problem. Real data: 0 problems.
  - Human-review queue: `data/review/ingredients-review.csv` (56 rows, 31 with nutrient gaps; columns for present values, missing nutrients, review provenance, registered sources, per-gap guidance and empty expert-decision columns). The remaining real gaps stay `null`: sat_fat 21, sugars 31, energy 4 — the FCTB-2013 PDF tables have no sat_fat/sugars columns and the four unverified mixture ingredients need a verified source; no values invented.
  - Sources register: `usda-fdc` licence recorded as CC0 1.0 (public domain, per the FoodData Central API guide, checked 2026-11-19). FCTB-2013 / IFCT-2017 licences are not yet verified and remain unrecorded rather than guessed.
  - FoodBD rule made explicit in `docs/EVAL_DATASETS.md`: dataset nutrition estimate fields are annotations with their own provenance, never promoted into `packages/knowledge`.

## Decisions and evidence

- **Branch/tag state (verified):** work happens only on `improvement/development`; `main` untouched locally. The branch is rooted at `2d51bb3` (audit-baseline history) and now includes the latest `main` state.
- **Tag discrepancy (reported, not modified):** local `v1.0.0` (annotated tag object `1ecd568`) targets `a38d74e` (audit-report commit, pre-P4-X04/X05). The pushed remote `refs/tags/v1.0.0` targets `a377f77` (current main tip: audit report + P4-X04 + P4-X05). No tag was moved, deleted or rewritten. The remote tag preserves the full pre-improvement state; the local tag preserves the audit snapshot. If the user wants them identical, the corrective step is `git fetch origin --tags --force` (fast-forward the local tag to the pushed one) — a user decision, not agent action, since the plan forbids the agent moving `v1.0.0`.
- **Test counts are recorded, not hard-coded as acceptance criteria** (per plan §2.2).

## Approval gates awaiting the user

- **Dataset download approval (Phase 3):** resolved — approved and downloaded 2026-11-18.
- **Gemini benchmark run (Phase 4, still open):** the 200-image Gemini column needs either a key confirmed to be on the free tier or explicit approval of a paid run (estimated well under $1); command recorded in `docs/MODEL_COMPARISON.md` §4. The Phase 4 recommendation does not depend on this run.
- **KV cache provisioning (Phase 2 follow-up):** using `KvScanCache` in the deployed Worker requires creating the `SCAN_CACHE_KV` namespace and uncommenting the `[[kv_namespaces]]` block in `apps/api/wrangler.toml` — a Cloudflare resource creation, hence user-approved work.
- **Global budget enforcement:** the daily AI budget is per-isolate in-memory; globally atomic enforcement needs Durable Objects (paid-tier feature on the free plan) — deferred behind the spend gate.
- **Human nutrition review (Phase 6):** `data/review/ingredients-review.csv` is ready for a qualified reviewer (31 ingredients with nutrient gaps; sat_fat/sugars need USDA FDC or IFCT 2017 lookups). Filling those gaps is human-review work, not agent work.
- Upcoming: production/deploy + public-release gates (Phase 10).

## Risks / known limitations

- Recognition accuracy of the production Gemini path on real BD data is unmeasured (the benchmark measured only the local model; the Gemini column is spend-gated) — measurable later at no code cost.
- The local 3B model measured at 44.5% top-1 with confident wrong answers and 0.5% unknown rate — confirmed unsuitable for production; recorded as evidence in `docs/MODEL_COMPARISON.md`.
- The daily AI budget is enforced per isolate, not globally across Cloudflare's edge; a burst spread over many isolates can exceed the configured daily count — documented in `docs/PRODUCTION_RELIABILITY.md`, needs Durable Objects (spend gate).
- KV cache is eventually consistent: a just-cached scan may briefly be re-analyzed by another edge location (cost, not correctness).
- The web scan page still uses the native file picker without camera-flow polish — Phase 8.

## Next phase

Phase 7 — food safety and allergen correctness. Open decisions for the user: (a) run the spend-gated Gemini benchmark column (command in `docs/MODEL_COMPARISON.md` §4); (b) approve proposed catalogue/eval label mappings beyond the current 8, so benchmark recognition can be scored against catalogue-only dishes too.
