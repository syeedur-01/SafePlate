# SafePlate v2.0.0 Progress

Updated: 2026-11-18
Branch: `improvement/development`
Baseline tag: `v1.0.0` (remote tag → `a377f77`; local tag → `a38d74e` — see notes)
Governing spec: `SAFEPLATE_V2_IMPROVEMENT_PLAN.md` (repo root)

| Phase | Status      | Commit                     | Checks                                                                             | Notes / blockers                                                                  |
| ----- | ----------- | -------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 0     | Complete    | `fc6b771` + Phase 0 commit | `pnpm check` exit 0 (793 tests), `pnpm verify` 0 problems, web build within budget | Tag discrepancy documented below                                                  |
| 1     | In progress |                            |                                                                                    | P4-X04/X05 already merged from main; remaining: status-board + doc reconciliation |
| 2     | Not started |                            |                                                                                    |                                                                                   |
| 3     | Not started |                            |                                                                                    | Dataset licence audit is a gate before any image use                              |
| 4     | Not started |                            |                                                                                    | Depends on Phase 3 benchmark                                                      |
| 5     | Not started |                            |                                                                                    |                                                                                   |
| 6     | Not started |                            |                                                                                    | Human-review dependent                                                            |
| 7     | Not started |                            |                                                                                    |                                                                                   |
| 8     | Not started |                            |                                                                                    |                                                                                   |
| 9     | Not started |                            |                                                                                    |                                                                                   |
| 10    | Not started |                            |                                                                                    | STOP: requires explicit user approval (release/deploy gate)                       |

## Current phase

Phase 1 — foundation and documentation debt. P4-X04 (bundle size budget: `apps/web/scripts/size.ts`, `apps/web/size-budget.json`) and P4-X05 (root `README.md`, `docs/KNOWN_LIMITATIONS.md`) were completed on `main` (PRs #75, #76) after the audit snapshot and are now merged into this branch. Remaining Phase 1 work: reconcile the plan status board with actual Git history, mark the real state of `TEAM.md` / `SPIKE_RESULTS.md` / `EVAL_REPORT.md` without fabricating results, correct any doc claims that do not match code (e.g. README claims scan responses are cached in production; the audit found the cache is not wired into the Worker/Node entry points — Phase 2 will wire it).

## Baseline (recorded 2026-11-18, commit `fc6b771`)

| Check                 | Command                       | Result                                                                                                               |
| --------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Full suite            | `pnpm check`                  | exit 0 — 85 test files, 793 tests passing (contracts 31, ai 26, knowledge 41, engine 447, tools 79, api 40, web 129) |
| Data verification     | `pnpm verify`                 | 30 dishes, 56 ingredients, 14 approved rules, 45 messages, 10 sources → 0 problems                                   |
| Web production build  | `pnpm --filter @sp/web build` | success; JS 193,610 B gzip + CSS 3,810 B gzip = 197,420 B ≤ budget 212,972 B                                         |
| Pre-existing failures | —                             | none found at baseline                                                                                               |

## Completed work

- Phase 0: verified branch/tag/remote safety; merged `origin/main` (P4-X04, P4-X05, merged audit report PR #77) into `improvement/development` (merge `fc6b771`, one add/add conflict in `docs/AUDIT_REPORT.md` resolved with the prettier-formatted merged version); formatted `SAFEPLATE_V2_IMPROVEMENT_PLAN.md`; recorded baseline.

## Decisions and evidence

- **Branch/tag state (verified):** work happens only on `improvement/development`; `main` untouched locally. The branch is rooted at `2d51bb3` (audit-baseline history) and now includes the latest `main` state.
- **Tag discrepancy (reported, not modified):** local `v1.0.0` (annotated tag object `1ecd568`) targets `a38d74e` (audit-report commit, pre-P4-X04/X05). The pushed remote `refs/tags/v1.0.0` targets `a377f77` (current main tip: audit report + P4-X04 + P4-X05). No tag was moved, deleted or rewritten. The remote tag preserves the full pre-improvement state; the local tag preserves the audit snapshot. If the user wants them identical, the corrective step is `git fetch origin --tags --force` (fast-forward the local tag to the pushed one) — a user decision, not agent action, since the plan forbids the agent moving `v1.0.0`.
- **Test counts are recorded, not hard-coded as acceptance criteria** (per plan §2.2).

## Approval gates awaiting the user

- None yet. Upcoming: dataset/legal gate (Phase 3 dataset use), production/deploy + spend gates (Phase 2 provisioning decisions, Phase 10), public-release gate (Phase 10).

## Risks / known limitations

- Recognition accuracy remains unmeasured (no real-image benchmark yet) — Phase 3.
- Production scan cache is not wired into Worker/Node entry points; budget guard is in-memory — Phase 2.
- README currently states scan responses "are cached for 24 h" in production; this is not yet true in code (Phase 2 wires it, or the claim gets corrected).

## Next phase

Phase 1 — documentation reconciliation (status board, TEAM/SPIKE/EVAL artifacts state, README/code mismatches).
