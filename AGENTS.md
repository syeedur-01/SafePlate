# AGENTS.md: rules for every coding agent working on SafePlate

Read this file completely before every task. These rules override your habits.

## 1. What this project is

**SafePlate** (working name) is a bilingual (Bangla/English) web app for the International AI Builders Congress 2026. A user photographs a **dish** or a **packaged-food label**. The app shows:

1. a **Safety card**: a transparent risk score, every point linked to evidence;
2. **Warnings for this user** (health conditions and allergies, stored on the device only);
3. a **Nutrition card** (always marked "estimated", shown only when data coverage is good enough);
4. a **swap suggestion and shopping list**.

> **AI perceives. Deterministic code decides.** Scores, warnings and nutrient numbers never come from an LLM.
> The LLM only reads the photo: which dish it might be, what a label says, which visible spoilage signs it sees.

Deadline: MVP video due **Oct 31, 2026** (exact cutoff to be confirmed by the team). Feature freeze: **Thu Oct 29, night**. Budget: **$0**.

## 2. Your workflow for EVERY task (no exceptions)

1. You are given a **card ID** (for example `P1-A01`). Open it in `docs/plan/PHASE_*.md`.
2. Read, in this order: this file, then the card, then the sections of `docs/TECH_DESIGN.md` the card names, then the files the card names under **Read**.
3. Check the card's **Depends on**. If a dependency is not merged into `main`, **stop and report**. Do not stub around it.
4. Start clean:
   - `git status --porcelain` must print nothing. If it prints anything, stop and report.
   - `git switch main && git pull --ff-only`. If the pull is not a clean fast-forward, stop and report.
   - `git switch -c <branch>` using the branch name in the card.
5. Write the **tests first** (the card contains them or says exactly what to assert). Run them. Confirm they fail for the right reason.
6. Implement until the tests pass. Touch **only** the files the card lists under **Files**.
7. Run `pnpm check` (typecheck + lint + tests). Everything must be green.
8. Commit with the card's commit message. One card = one branch.
9. Before pushing, run the **secrets check** (section 8). Then `git push -u origin HEAD` (the card branch only).
10. Reply with the **report** (section 9). Do not start the next card unless asked.

## 3. Hard rules

1. **No source, no value.** Never invent a nutrient value, a threshold, an allergen list, a citation or a regulation. If it is not in a source file or the card, leave it `null` and report it. **`null` is not `0`.**
2. **Never ask an LLM to decide** a score, a warning level or a nutrient number. LLM calls exist only in `packages/ai`.
3. **The health profile never leaves the device.** It must not appear in any API request, log line, prompt or test fixture that is sent over the network. The scan request schema is `.strict()` for this reason.
4. **Touch only the files in the card's Files list.** Never edit `packages/contracts` unless the card is a `contract-change` card.
5. **No new dependencies** except those the card lists. Pin exact versions (no `^`, no `~`).
6. **Tests never touch the network or a real AI.** Use `MockProvider` and a mocked `fetch`.
7. **Estimated and draft labels are mandatory.** Dish quantities and serving weights are estimates. Rules with `status: "draft"` must be shown as draft. Never remove these labels to look cleaner.
8. **Strict TypeScript.** No `any`, no `@ts-ignore`, no `@ts-expect-error` without a one-line reason, no skipped or `.only` tests.
9. **Do not edit data files in `packages/knowledge/data/source/`.** They are the team's original input. Derived data goes to `packages/knowledge/data/normalized/` or `data/proposals/`.
10. **Proposals are not approvals.** Scripts that match ingredients or extract rules write to `data/proposals/`. A human approves. Only approved entries may be applied.
11. **Git:** you may commit and push **only your card branch**. Never push `main`, never force-push, never rebase a shared branch, never resolve a merge conflict. If a push fails (for example authentication), stop and report. Do not change remotes or credentials.

## 4. Repo map and ownership

| Path                              | Owner track | Notes                                                                           |
| --------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `packages/contracts/`             | shared      | Zod schemas, types, test builders. Changes only by `contract-change` PR         |
| `packages/engine/`                | A           | Pure functions: nutrition, safety, suitability, swaps, shopping, label analysis |
| `packages/ai/`                    | B           | Vision providers, prompts, JSON parsing and validation, cache                   |
| `apps/api/`                       | B           | Hono API (Cloudflare Workers entry plus Node entry)                             |
| `apps/web/`                       | C           | Vite + React + Tailwind web app                                                 |
| `packages/knowledge/`             | D           | Data, rules, messages, loaders                                                  |
| `tools/`                          | D           | Data scripts (fetch, match, coverage, validate)                                 |
| `docs/`, root configs, `.github/` | shared      | Only by cards that list them                                                    |

Each package has `src/` and `test/`. Internal packages are consumed as TypeScript source (`"main": "src/index.ts"`), with no build step.

## 5. Commands

```
pnpm install                 # after every pull
pnpm check                   # typecheck + lint + all tests (must be green)
pnpm --filter @sp/engine test    # one package's tests
pnpm --filter @sp/web dev        # web dev server (after P1-C01)
pnpm --filter @sp/api dev        # API on Node (after P1-B01)
```

## 6. Code conventions

- TypeScript strict, ES modules, 2-space indent, semicolons, single quotes (Prettier decides).
- Pure functions in `engine`: no `Date.now()`, no `Math.random()`, no I/O. Inject anything variable as an argument.
- Names: files `kebab-case.ts`, types `PascalCase`, functions `camelCase`, constants `UPPER_SNAKE`.
- Every exported function has a one-line doc comment saying what it returns.
- Message text never lives in code. Engine and API return **message keys** (`warn.sodium_high`). The UI looks up English and Bangla text in `packages/knowledge/data/messages.json`.
- Small files: if a file passes about 200 lines, split it.

## 7. Testing conventions

- Vitest. Tests live in `test/*.test.ts` next to `src/` of the same package.
- Build test data with the builders from `@sp/contracts/testing` (`makeDish`, `makeIngredient`, `makeProfile`). Do not hand-write 40-field objects.
- One behaviour per test, named as a sentence. Test the edge cases the card lists.
- Real data may be used in tests only through `@sp/knowledge` loaders.

## 8. Security and privacy rules

- No secret in the repo, ever. Keys live in `.env` (gitignored) locally and in Cloudflare secrets in production. `.env.example` has empty values only.
- **Secrets check before every push:** run `git diff main --name-only` and confirm (a) every file is in the card's Files list and (b) none is named `.env*` (except `.env.example`), `*.pem`, `*.key`, or under `data/raw/`. Run `git diff main | grep -iE "api[_-]?key|secret|token" ` and read every hit.
- Uploaded images are processed in memory and never stored by the API. Do not log image data.
- The API allows only the configured origin (CORS), limits body size, and accepts only `image/jpeg`, `image/png`, `image/webp`.
- Never put the health profile into a URL, query string, log or analytics call.

## 9. Report format (end of every task)

```
CARD: P1-A01
STATUS: done | unfinished | blocked
BRANCH: a/P1-A01-nutrition   PUSHED: yes | no (reason)
FILES CHANGED: (list)
TESTS: (command) -> (paste the summary line, for example "Tests 12 passed (12)")
CHECK: pnpm check -> green | red (paste first error)
DEVIATIONS: (anything you did differently from the card, and why)
OPEN QUESTIONS / RISKS: (anything a human must decide or verify)
```

## 10. When blocked

Stop. Do not work around a missing dependency, a contradiction, an unclear requirement, a failing download, or a missing data file. Report it (section 9) with `STATUS: blocked`. A clear "blocked" report is better than a wrong implementation. If a card is only partly done, commit what is green, push the branch, and report `STATUS: unfinished` so a teammate can continue.

## 11. Definition of done (every card)

1. All acceptance tests in the card pass and were written before the implementation.
2. `pnpm check` is green.
3. No files changed outside the card's **Files** list.
4. No placeholders, skipped tests, invented data or leaked secrets.
5. The commit message matches the card.
6. The branch is pushed and the report is complete.
