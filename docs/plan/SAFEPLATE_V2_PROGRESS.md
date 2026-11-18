# SafePlate v2.0.0 Progress

Updated: 2026-11-18
Branch: `improvement/development`
Baseline tag: `v1.0.0` (remote tag → `a377f77`; local tag → `a38d74e` — see notes)
Governing spec: `SAFEPLATE_V2_IMPROVEMENT_PLAN.md` (repo root)

| Phase | Status      | Commit                     | Checks                                                                             | Notes / blockers                                                                                  |
| ----- | ----------- | -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 0     | Complete    | `fc6b771` + Phase 0 commit | `pnpm check` exit 0 (793 tests), `pnpm verify` 0 problems, web build within budget | Tag discrepancy documented below                                                                  |
| 1     | Complete    | `a60066d`                  | `pnpm check` green at commit                                                       | Honest doc status banners; status board reconciled; README cache claim corrected                  |
| 2     | Complete    | `6dd7c5c`                  | `pnpm check` exit 0 (86 files / 815 tests), `pnpm verify` 0 problems               | KV binding + global budget enforcement remain approval-gated (see docs/PRODUCTION_RELIABILITY.md) |
| 3     | In progress | `1396571`                  | `pnpm check` exit 0, `pnpm verify` 0 problems                                      | Scaffolding complete; real dataset download awaits user approval (docs/EVAL_DATASETS.md)          |
| 4     | Not started |                            |                                                                                    | Depends on Phase 3 benchmark                                                                      |
| 5     | Not started |                            |                                                                                    |                                                                                                   |
| 6     | Not started |                            |                                                                                    | Human-review dependent                                                                            |
| 7     | Not started |                            |                                                                                    |                                                                                                   |
| 8     | Not started |                            |                                                                                    |                                                                                                   |
| 9     | Not started |                            |                                                                                    |                                                                                                   |
| 10    | Not started |                            |                                                                                    | STOP: requires explicit user approval (release/deploy gate)                                       |

## Current phase

Phase 2 — production AI reliability, privacy, cost control (complete at `6dd7c5c`).

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

## Decisions and evidence

- **Branch/tag state (verified):** work happens only on `improvement/development`; `main` untouched locally. The branch is rooted at `2d51bb3` (audit-baseline history) and now includes the latest `main` state.
- **Tag discrepancy (reported, not modified):** local `v1.0.0` (annotated tag object `1ecd568`) targets `a38d74e` (audit-report commit, pre-P4-X04/X05). The pushed remote `refs/tags/v1.0.0` targets `a377f77` (current main tip: audit report + P4-X04 + P4-X05). No tag was moved, deleted or rewritten. The remote tag preserves the full pre-improvement state; the local tag preserves the audit snapshot. If the user wants them identical, the corrective step is `git fetch origin --tags --force` (fast-forward the local tag to the pushed one) — a user decision, not agent action, since the plan forbids the agent moving `v1.0.0`.
- **Test counts are recorded, not hard-coded as acceptance criteria** (per plan §2.2).

## Approval gates awaiting the user

- **Dataset download approval (Phase 3):** the licence audit is recorded in `docs/EVAL_DATASETS.md`; BD-Food33 (CC0 1.0, 133 MB zip, published SHA-256) is approved-for-eval by the audit but the actual download into the gitignored `eval/datasets/` directory needs explicit user confirmation.
- **KV cache provisioning (Phase 2 follow-up):** using `KvScanCache` in the deployed Worker requires creating the `SCAN_CACHE_KV` namespace and uncommenting the `[[kv_namespaces]]` block in `apps/api/wrangler.toml` — a Cloudflare resource creation, hence user-approved work.
- **Global budget enforcement:** the daily AI budget is per-isolate in-memory; globally atomic enforcement needs Durable Objects (paid-tier feature on the free plan) — deferred behind the spend gate.
- Upcoming: production/deploy + public-release gates (Phase 10).

## Risks / known limitations

- Recognition accuracy remains unmeasured (no real-image benchmark yet) — Phase 3.
- The daily AI budget is enforced per isolate, not globally across Cloudflare's edge; a burst spread over many isolates can exceed the configured daily count — documented in `docs/PRODUCTION_RELIABILITY.md`, needs Durable Objects (spend gate).
- KV cache is eventually consistent: a just-cached scan may briefly be re-analyzed by another edge location (cost, not correctness).
- The web scan page still uses the native file picker without camera-flow polish — Phase 8.

## Next phase

Finish Phase 3: download BD-Food33 (after user approval), verify its SHA-256, inspect categories, write the human-reviewable label map, build the real manifest, and — once the user approves paid Gemini calls — produce the first real recognition report. Phase 4 (hybrid cloud/local comparison) builds on the same benchmark.
