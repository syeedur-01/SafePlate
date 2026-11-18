# Bug-fix queue

Every bug found during demo preparation, evaluation runs or review is logged in the queue below **before** it is fixed. One bug = one branch = one mini-card. This file is the queue; git history records what changed.

## Severity policy

| Severity | Meaning                                                                                     | Allowed after freeze?           |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------------- |
| P0       | Crashes, wrong safety or allergen result, privacy leak, secret exposed                      | Yes, immediately                |
| P1       | Broken main flow on a phone, wrong or misleading text, missing "estimated" or "draft" label | Yes                             |
| P2       | Cosmetic, minor wording                                                                     | **No.** Add to the Phase 5 list |

## Every bug fix is a mini-card

1. Write a failing test that reproduces it.
2. Make the smallest change that fixes it.
3. `pnpm check` green.
4. Commit `fix(<area>): <bug id> <what>`.
5. Report.

No other changes in the same branch. The branch name follows the card: `<track>/BUG-<n>-<slug>`, for example `c/BUG-01-result-overflow`.

## Queue

| id                    | severity | where | how to reproduce | owner | status |
| --------------------- | -------- | ----- | ---------------- | ----- | ------ |
| _No bugs logged yet._ |          |       |                  |       |        |

Statuses: `open`, `in progress`, `fixed`, `deferred to phase 5` (P2 after freeze).
