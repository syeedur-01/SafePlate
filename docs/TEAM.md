# TEAM.md: fill in on day one

## People and tracks

| Person | GitHub handle | Track | Owns | Buddy reviewer (reviews this person's PRs) |
|---|---|---|---|---|
| | @ | A Engine | `packages/engine` | |
| | @ | B AI and API | `packages/ai`, `apps/api` | |
| | @ | C Web | `apps/web` | |
| | @ | D Data | `packages/knowledge`, `tools/` | |

The repo owner (creates the repo, deploys, tags): ______________

Replace `@TEAM-A` to `@TEAM-D` in `.github/CODEOWNERS` with the real handles.

## Agents and tools each person uses

| Person | Agent or tool | Model (free) | Notes (for example "needs shorter cards") |
|---|---|---|---|
| | | | |

If an agent keeps failing a card: switch the model or tool, restart the card in a fresh session, and tell the team. Do not weaken the tests.

## Accounts checklist

- [ ] GitHub: everyone can push a branch
- [ ] Cloudflare account (free): repo owner (Worker and Pages)
- [ ] AI provider key: one shared key in the repo owner's local `.env` and in Cloudflare secrets. Check the provider's console for the current free limits and the current model name
- [ ] Render account (fallback only, do not create a service unless P1-B04 says so)

## Communication rules

- One chat for the team. Announce every `contract-change` PR there.
- When you finish a card, post the card ID and the PR link.
- When you are blocked, post it immediately with the agent's `blocked` report.
- Tell the team before touching a file outside your track.

## Daily rhythm (Oct 23 to Oct 30)

| Time | What |
|---|---|
| Morning (15 min) | Status board in `docs/plan/00_INDEX_AND_WORKFLOW.md`: who runs which card today |
| Midday | Merge what is green; everyone pulls |
| Evening (15 min) | Update the status board; tag the phase if its exit criteria are met; decide tomorrow's cards |

## Human tasks and owners

| Task | Owner | Due |
|---|---|---|
| Expert (nutritionist or doctor) booked | | Oct 25 |
| Test photos collected (50 to 100 target, at least 25 usable) | | Oct 27 |
| Bangla review of messages | | Oct 27 |
| Deploy and phone test | | Oct 29 |
| Demo video recorded | | Oct 30 or 31 |
| Submission sent (confirm the exact cutoff) | | before Oct 31 |
