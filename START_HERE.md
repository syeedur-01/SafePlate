# START HERE: SafePlate agent kit

Four people, each driving a free coding agent, build **SafePlate** for the International AI Builders Congress. This kit is what the agents and you work from.

## What is in the box

| Path                                 | What it is                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `AGENTS.md`                          | Rules every agent reads before every task. Stays at the repo root                |
| `docs/TECH_DESIGN.md`                | How the app works: data, engine, AI layer, API, web, privacy. Wins over any card |
| `docs/plan/00_INDEX_AND_WORKFLOW.md` | How to run a card, schedule, status board, cut order, human-only tasks           |
| `docs/plan/PHASE_0` to `PHASE_4`     | The task cards (tests first, exact files, commit message)                        |
| `docs/plan/PHASE_5_OUTLINE.md`       | After the MVP: accounts, community, final version (outline only)                 |
| `docs/TEAM.md`                       | Template to fill in today                                                        |
| `packages/knowledge/data/source/`    | Your two data files, unchanged. Never edit them                                  |

## Your first hour (today, Fri Oct 23)

1. The repo owner creates the GitHub repo, unzips this kit into it, pushes to `main`, and adds the teammates (card P0-H01).
2. Fill in `docs/TEAM.md`: who is track A, B, C, D.
3. Run **P0-X01** in a fresh agent session (any one person). Merge it.
4. Then P0-X02, P0-X03, P0-X04 in order (same person or share them).
5. In parallel, track D runs **P0-D01** and the others read their Phase 1 cards.

Prompt to give an agent (change the card ID):

```
Read AGENTS.md completely. Then open docs/plan/<PHASE FILE> and read card <CARD ID>.
Follow AGENTS.md section 2 exactly. Do only this card, nothing else.
When you finish, reply with the report from AGENTS.md section 9.
```

## Dates

| Phase                                       | Dates                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| 0 Setup and contracts                       | Fri Oct 23                                                              |
| 1 Building blocks                           | Sat Oct 24 to Sun Oct 25                                                |
| 2 Feature completion                        | Mon Oct 26 to Tue Oct 27                                                |
| 3 Integration and deploy (freeze Thu night) | Wed Oct 28 to Thu Oct 29                                                |
| 4 Hardening, tag `mvp-demo`                 | Fri Oct 30                                                              |
| Buffer, submit                              | Sat Oct 31 (confirm the exact cutoff and time zone with the organizers) |

## Honest notes about this kit

- **Nothing in this kit was executed.** The code in the cards (schemas, tests, helpers) was written without running `npm install` or the tests. Each card's tests are the check: an agent runs them and shows the output. If a test in a card is wrong, the agent reports it as blocked; fix the card, not the tests' intent.
- **Library versions and APIs change** (Gemini REST shape and free limits, Cloudflare and Render commands, Tailwind, Zod). The cards say where to check current docs and pin Zod 3.x and Tailwind 3.4 on purpose.
- **The data has gaps** (24 of 56 ingredients have no nutrient values; saturated fat and sugars are missing for all). The design handles this with a coverage rule and a gate, and Phase 1 data cards try to close the gaps from permitted sources, with a human approving every match.
- **Health content needs a human expert.** Quantities, rules and Bangla wording stay marked "estimated" or "draft" until a nutritionist or doctor and native speakers review them.
- The video and the submission are yours; the agents only write code.
