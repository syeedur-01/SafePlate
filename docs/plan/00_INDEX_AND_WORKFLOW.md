# 00. Index and workflow

## How to run a card (the only way)

1. Open a **fresh agent session** (Antigravity, OpenCode, or any free coding agent). One card per session.
2. Paste exactly this, replacing the card ID:

```
Read AGENTS.md completely. Then open docs/plan/<PHASE FILE> and read card <CARD ID>.
Follow AGENTS.md section 2 exactly. Do only this card, nothing else.
When you finish, reply with the report from AGENTS.md section 9.
```

3. The agent writes tests first, implements, runs `pnpm check`, commits, and pushes **its card branch**.
4. A human opens the pull request, reads the diff against the card's Files list, checks that CI is green, gets one teammate to look (about 10 minutes), and **squash-merges**. Delete the branch.
5. Everyone runs `git switch main && git pull --ff-only && pnpm install` before their next card.

Never let an agent run a whole phase unattended. If an agent drifts, close the session, `git switch main`, delete the branch, and start the card again in a fresh session. Cards are small so restarting is cheap.

## Tracks and owners (fill in `docs/TEAM.md`)

| Track            | Owns                           | Skill needed                                                |
| ---------------- | ------------------------------ | ----------------------------------------------------------- |
| **A** Engine     | `packages/engine`              | Logic and testing. Pure TypeScript                          |
| **B** AI and API | `packages/ai`, `apps/api`      | Backend. Cloudflare                                         |
| **C** Web        | `apps/web`                     | Front-end design and React                                  |
| **D** Data       | `packages/knowledge`, `tools/` | Careful reading, spreadsheets. Coordinates the nutritionist |

Track D is the **critical path** for the demo's nutrition numbers. If A, B or C finish early, they help D by running the D cards that are marked "any track".

## Schedule (today is Fri Oct 23)

| Phase                        | Dates                    | Goal                                           | Exit                                                                  |
| ---------------------------- | ------------------------ | ---------------------------------------------- | --------------------------------------------------------------------- |
| **0** Setup and contracts    | Fri Oct 23               | Repo, CI, contracts, mocks, data fetch         | All P0 cards merged; `pnpm check` green on `main`; tag `phase-0-done` |
| **1** Building blocks        | Sat Oct 24 to Sun Oct 25 | Each track builds its module against mocks     | Tag `phase-1-done`                                                    |
| **2** Feature completion     | Mon Oct 26 to Tue Oct 27 | Every feature works with mocks and real data   | Tag `phase-2-done`; coverage gate decided                             |
| **3** Integration and deploy | Wed Oct 28 to Thu Oct 29 | Real API connected, deployed, tested on phones | **Feature freeze Thu night**; tag `phase-3-done`                      |
| **4** Hardening              | Fri Oct 30               | Bug fixes only, demo scenarios, final deploy   | Tag `mvp-demo`. Team records the video from this tag                  |
| Buffer                       | Sat Oct 31               | Re-record or fix. Submit                       | Submit early. Confirm the exact cutoff with the organizers            |
| **5** Final version          | After submission         | Outline only (accounts, community)             |                                                                       |

The demo video and the submission are handled by the team, not by agents.

## Order of work (critical path)

```
P0-H01, P0-H02 (humans)  ─┐
P0-X01 → P0-X02 → P0-X03 → P0-X04 ──► Phase 1: A, B, C, D run in parallel
P0-D01 (independent)      ─┘
```

Merge order inside a phase: contracts first, then providers, then consumers. If your card needs something that is not merged, you are blocked. Report and switch to another card.

## Contract-change process (shared files)

`packages/contracts`, root configs and the lockfile are shared. To change them:

1. Open a card of type `contract-change` (any phase file lists them as `X-` cards, or the team writes one on the spot).
2. Branch `x/<slug>`, PR labelled `contract-change`, announced in the team chat.
3. One person from each other track approves. Merge within hours.
4. Everyone pulls before the next card.

If `pnpm-lock.yaml` conflicts: `git checkout main -- pnpm-lock.yaml && pnpm install`, then commit.

## Cut order (if time runs short, cut in this order)

1. P2-A03 and P2-B02: the **label** scan path (everything else keeps working).
2. P2-A01 and P2-A02 plus P2-C04: swaps and shopping list.
3. P2-C06 Bangla UI polish (keep English first; keep Bangla dish names).
4. P3-X07 accessibility pass (keep basic contrast and tap targets).
5. History screen (P2-C05 keep only "delete my data").

**Never cut:** dish scan, confirm dish, Safety card with evidence, allergen warnings, honest-limits notice, "estimated" and "draft" labels, delete-my-data.

## Data fallback (important)

If nutrient coverage is poor by the end of Phase 2, show numbers only for dishes that pass the coverage gate (`MIN_COVERAGE` 0.8 for the nutrients the user's conditions need). The other dishes still give safety and allergen results and say "not enough data" for nutrition. The demo then uses the best-covered dishes. Decide the gate list at `P2-D06`.

## Human-only tasks (agents cannot do these)

| Task                                                            | Who                                          | When          |
| --------------------------------------------------------------- | -------------------------------------------- | ------------- |
| Create repo, add teammates, set protections                     | repo owner                                   | P0 (hour 1)   |
| Create accounts: AI provider key, Cloudflare, GitHub            | each person for their own; one shared AI key | P0            |
| Place data files; download raw sources if the agent cannot      | D                                            | P0            |
| Approve or reject match proposals (ingredients)                 | D plus nutritionist if possible              | P1            |
| Review draft rules and quantities with a nutritionist or doctor | D                                            | P2 (book now) |
| Collect 50 to 100 test photos (dish photos and label photos)    | team                                         | P1 to P2      |
| Translate or check Bangla messages                              | team (native speakers)                       | P2            |
| Record the demo video and submit                                | team                                         | P4 and buffer |

## Status board (update as cards merge)

| Card    | Track     | Title                                                 | Status  |
| ------- | --------- | ----------------------------------------------------- | ------- |
| P0-H01  | human     | Repo, accounts, keys                                  | done    |
| P0-H02  | human     | Data files in place                                   | done    |
| P0-X01  | shared    | Scaffold monorepo                                     | done    |
| P0-X02  | shared    | Contracts: knowledge schemas                          | done    |
| P0-X03  | shared    | Contracts: profile, API, analysis, rules, builders    | done    |
| P0-X04  | shared    | Mock scans and knowledge loader                       | done    |
| P0-D01  | D         | Fetch raw sources or notify                           | done    |
| P1-A01  | A         | Nutrition computation                                 | done    |
| P1-A02  | A         | Allergen conflicts                                    | done    |
| P1-A03  | A         | Safety scoring                                        | done    |
| P1-A04  | A         | Suitability warnings                                  | done    |
| P1-B01  | B         | API skeleton                                          | done    |
| P1-B02  | B         | Provider interface, mock, JSON parsing                | done    |
| P1-B03  | B         | Gemini provider                                       | done    |
| P1-B04  | B         | Workers deploy spike                                  | done    |
| P1-C01  | C         | Web scaffold and design system                        | done    |
| P1-C02  | C         | Profile store and onboarding                          | done    |
| P1-C03  | C         | Image downscale, scan screen, API client              | done    |
| P1-C04  | C         | Risk gauge and evidence components                    | done    |
| P1-D01  | D         | Normalize data                                        | done    |
| P1-D02  | D         | FCTB match proposals                                  | done    |
| P1-D03  | D         | USDA gap proposals                                    | done    |
| P1-DH01 | human     | Approve proposals                                     | done    |
| P1-DH02 | human     | Gap-fill lookups and second approval round (inserted) | done    |
| P1-D04  | D         | Apply approved matches and coverage report            | done    |
| P2-A01  | A         | Swap suggestions                                      | done    |
| P2-A02  | A         | Shopping list                                         | done    |
| P2-A03  | A         | Label analysis                                        | done    |
| P2-A04  | A         | `analyze()` orchestrator and golden test              | done    |
| P2-B01  | B         | `/api/scan` for dishes                                | done    |
| P2-B02  | B         | `/api/scan` for labels                                | done    |
| P2-B03  | B         | Cache and guards                                      | done    |
| P2-B04  | B         | Worker config and deploy script                       | done    |
| P2-C01  | C         | Confirm-dish screen                                   | done    |
| P2-C02  | C         | Result: Safety and For you                            | done    |
| P2-C03  | C         | Result: Nutrition                                     | done    |
| P2-C04  | C         | Result: Swap and shopping                             | done    |
| P2-C05  | C         | History and settings                                  | done    |
| P2-C06  | C         | Bangla UI and About                                   | done    |
| P2-D01  | D         | Source register                                       | done    |
| P2-D02  | D         | Safety rules from sources                             | done    |
| P2-D03  | D         | Health rules from sources                             | done    |
| P2-D04  | D         | Allergen keywords and messages                        | done    |
| P2-D05  | D         | Evaluation manifest and checker                       | done    |
| P2-D07  | D         | Review pack export (CSV for the expert)               | done    |
| P2-DH01 | human     | Expert review session                                 | done    |
| P2-D06  | D         | Apply approvals and decide the coverage gate          | done    |
| P3-X01  | C         | Web connected to the real API                         | done    |
| P3-X02  | C+A       | End-to-end wiring of the engine                       | done    |
| P3-X03  | B         | End-to-end pipeline test                              | done    |
| P3-X04  | B+human   | Cloudflare deploy                                     | done    |
| P3-X05  | D+B       | Evaluation on real photos                             | partial |
| P3-X06  | C         | Low confidence, errors, waking state                  | done    |
| P3-X07  | C         | Responsive and accessibility pass                     | done    |
| P3-X08  | D         | Data freeze                                           | done    |
| P4-X01  | C         | Demo scenarios                                        | done    |
| P4-X02  | any       | Bug-fix queue                                         | done    |
| P4-X03  | D         | Final data consistency check                          | done    |
| P4-X04  | C         | Performance                                           | done    |
| P4-X05  | human+any | README, disclaimers, tag `mvp-demo`                   | partial |

Status reconciled against Git history on 2026-11-18 (PRs #1–#77; every card above is merged). The two partial cards:

- **P3-X05**: the evaluation runner, metrics and report scaffolding are merged (`tools/src/eval-run.ts`), but the evaluation was never run on real photos because no licensed image set was committed. This work continues as Phase 3 of `SAFEPLATE_V2_IMPROVEMENT_PLAN.md`.
- **P4-X05**: `README.md` and `docs/KNOWN_LIMITATIONS.md` are merged (PR #76). The human release steps (tag `mvp-demo`, demo video, submission) were superseded by the v2 improvement programme; the repo now tags `v1.0.0` as the preserved pre-improvement baseline instead.
