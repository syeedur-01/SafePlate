# SafePlate v2.0.0 — Improvement Plan and Agent Execution Guide

**Plan created:** 18 November 2026  
**Baseline audit:** `AUDIT_REPORT.md`, dated 18 November 2026  
**Target release:** `v2.0.0`  
**Implementation branch:** `improvement/development`  
**Stable branch:** `main`  
**Agent workflow:** continuous, phase-by-phase execution with explicit approval gates  
**Preferred agent:** Qoder (the prompts are also compatible with OpenCode and similar coding agents)

> This is the implementation specification for the next SafePlate release. It is intentionally repository-specific. The coding agent must inspect the live repository before acting and must not assume this document overrides the actual code, tests, package scripts, Cloudflare configuration, dataset licences, or newer official documentation.

---

## 1. Product direction and decisions

### 1.1 User preferences

| Decision       | Selected preference | Implementation meaning                                                                                                                                                                                                                                     |
| -------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deadline       | **Balanced**        | Prioritize reliability and measurable product value. Do not rush low-confidence features or impose artificial calendar deadlines. Deliver in tested milestones.                                                                                            |
| AI strategy    | **Hybrid**          | Keep the cloud vision provider for the existing Cloudflare deployment. Add a local-model evaluation path on the development machine and compare it against the cloud provider using the same benchmark. Do not assume the local model is production-ready. |
| Deployment     | **Current**         | Retain the existing Cloudflare Workers API + web deployment. Do not migrate platforms or introduce a new hosting provider without a separate decision.                                                                                                     |
| Agent autonomy | **Continuous**      | The agent should implement, test, fix, document, commit and proceed through phases without waiting for approval after every small task. It must stop at the explicit approval gates in this document.                                                      |

### 1.2 Product principle to preserve

**AI perceives; deterministic code decides.** The vision model may identify candidates and transcribe visible label text. It must not calculate or invent nutrition, make unsupported food-safety determinations, or decide personal suitability. Nutrition, allergen matching, rules, scoring, warnings and swaps remain in the deterministic engine and the source-backed knowledge base.

### 1.3 Hybrid AI interpretation

The target architecture is deliberately conservative:

- **Cloud production path:** Gemini remains the production vision provider for the existing Cloudflare Worker unless benchmarking or availability evidence justifies a change.
- **Local evaluation path:** run one or more suitably licensed, vision-capable open-weight models locally on the Windows development machine with the RTX 4060. Use quantization or offloading only when supported by the selected model/runtime. Measure actual VRAM, latency, accuracy and structured-output reliability.
- **Shared provider contract:** both paths should implement the existing `VisionProvider` abstraction or a small compatible adapter, so the evaluation harness can compare them without duplicating the product pipeline.
- **No assumed local production fallback:** a model running on the developer's laptop is not reachable reliably by a public Cloudflare Worker. Do not make the deployed Worker depend on the laptop. A remote local-model endpoint would require separate hosting, security, availability, privacy and cost decisions.
- **No automatic model switch based only on a benchmark score:** report the results and recommend a default. Do not change production configuration until the user approves the change.

---

## 2. Verified starting point

The following baseline comes from the supplied `AUDIT_REPORT.md` (18 November 2026). The agent must re-check any item it intends to modify because the repository may have changed since the audit.

### 2.1 Repository and architecture

- pnpm TypeScript monorepo with strict TypeScript and Vitest.
- `packages/contracts`: Zod schemas, types and test builders.
- `packages/engine`: deterministic nutrition, safety scoring, suitability, swaps, shopping and label analysis.
- `packages/ai`: `VisionProvider`, Gemini raw REST provider, mock provider, prompts, JSON parsing/repair, in-memory scan cache and daily budget.
- `apps/api`: Hono API with Cloudflare Worker and Node entry points; `/api/health` and `/api/scan`.
- `apps/web`: Vite + React + Tailwind; the deterministic engine runs in the browser.
- `packages/knowledge`: source, normalized and runtime data; rules, messages, allergens and source register.
- `tools`: data fetch/match/apply/normalize/coverage/evaluation/verification/smoke utilities.
- The API returns identification/observations. Personalized analysis runs on the client, keeping the health profile out of the API request.

### 2.2 Test baseline

The auditor ran `pnpm check` successfully. The reported suite contained **84 test files and 791 passing tests**:

| Package   |   Tests |
| --------- | ------: |
| contracts |      31 |
| ai        |      26 |
| knowledge |      41 |
| engine    |     447 |
| tools     |      79 |
| api       |      40 |
| web       |     127 |
| **Total** | **791** |

Do not hard-code these counts as future acceptance criteria. Record the actual current counts and compare failures against the baseline.

### 2.3 Knowledge-base baseline

- 30 dishes, 56 ingredients and 238 dish-composition lines.
- All dish quantities and serving weights are marked `ESTIMATE`; all dishes need expert review.
- 21 ingredients have unverified source IDs.
- Saturated fat and sugars are null for all 56 ingredients in the audit snapshot.
- Only one dish has lab values.
- The reported nutrition review was AI-assisted, not a real human nutritionist's approval.
- The source register had 10 entries, 8 verified and 2 unverified, but no licence/attribution fields.
- 10 safety rules and 4 health rules existed; their approval status does not prove professional validation.

### 2.4 Known implementation gaps from the audit

1. `MemoryScanCache` is tested but not connected in the production Worker or Node entry points.
2. The budget guard is in-memory (reported as 200 calls/day) and resets when the Worker instance restarts.
3. `AI_PROVIDER` defaults to `mock` when unset, risking silent fixture output outside tests.
4. Provider/network errors are not retried; the existing retry path only covers invalid model output.
5. No real photo evaluation set or committed recognition evaluation report exists.
6. The evaluation runner targets a deployed API and has not been demonstrated on a reproducible real-image benchmark.
7. Recognition and nutrition coverage use the same 30-dish list.
8. Upload validation lacks early client-side file checks and server-side magic-byte verification.
9. Allergen matching has known false-positive and false-negative risks; “may contain” parsing is absent.
10. Storage-duration trigger logic exists, but no rules are configured and the UI sends storage as unknown.
11. Frontend issues include refresh recovery, non-clickable history, missing 404, hidden confidence, unclear “None of these” handling, missing cancellation/progress and late upload-size errors.
12. No browser E2E suite or coverage reporting is configured.
13. The plan/status board is stale; P4-X04 (performance/size budget) and P4-X05 (README/limitations/docs) were not complete in the audit snapshot.

### 2.5 Important correction to the audit's model-ID warning

The audit flagged `gemini-3.5-flash-lite` as likely invalid. Google's current public Gemini model catalogue, checked while preparing this plan on 18 November 2026, lists the exact API model ID `gemini-3.5-flash-lite` as a stable model. Therefore, **do not replace it merely because the audit questioned it**. Still verify that the exact model is available to this API key/project, accepts the image input used by SafePlate, is supported in the target account/region, and has an acceptable lifecycle and cost. A documentation listing is not proof that the deployed key can call it successfully.

---

## 3. Release safety and Git workflow

### 3.1 Required branch and tag model

| Name                      | Purpose                                        | Rule                                                                             |
| ------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `main`                    | Stable v1 line and later accepted release line | Never use for experimental implementation.                                       |
| `v1.0.0`                  | Exact pre-improvement baseline commit          | Preserve permanently; do not move or delete it. Publish a GitHub Release for it. |
| `improvement/development` | All v2 implementation work                     | Agent works here only.                                                           |
| `v2.0.0`                  | Accepted improved release                      | Create only after user acceptance and final checks.                              |

The v1.0.0 tag/release and the improvement branch must be verified in the actual repository. The audit's clean `main` at `2d51bb3` is a historical snapshot, not proof that the user has already created the tag or pushed it to GitHub.

### 3.2 Preflight rules for the agent

Before making any changes:

1. Run `git status --short --branch`, `git branch --show-current`, `git log -1 --oneline`, `git tag --list`, and `git remote -v`.
2. Confirm that the current branch is `improvement/development` and that the v1.0.0 baseline tag points to the intended pre-improvement commit.
3. If the agent is on `main`, a detached HEAD, or a different branch, do not edit project files. Report the exact safe next Git command instead.
4. If there are user changes, do not reset, clean, stash, overwrite or discard them. Report the state and preserve it.
5. Never rewrite history or force-push. Never move/delete `v1.0.0`.
6. Do not merge into `main`, create `v2.0.0`, publish a GitHub Release or deploy production until the user has reviewed and approved the release.

### 3.3 Commit policy

- Commit after each completed phase or independently verifiable milestone.
- Use descriptive messages, e.g. `fix(api): wire production scan cache` or `test(eval): add reproducible vision benchmark`.
- Do not use phase numbers in commit messages unless the repository's own conventions require them.
- Do not commit `.env`, API keys, tokens, private images, raw datasets, local model weights, caches, generated temporary files or private user data.
- Keep large datasets and weights outside the Git repository, or in explicitly ignored directories. Commit only manifests, scripts, metadata and reports that are permitted to redistribute.

---

## 4. Architecture guardrails

The agent must preserve these invariants unless a later, explicit architecture decision is approved:

1. Health profile stays in browser storage and never enters `/api/scan`, logs, analytics or AI prompts.
2. The server remains an identification/observation service; personalized analysis remains client-side.
3. The LLM never provides authoritative nutrition totals, health suitability, allergy clearance or a definitive food-safety verdict.
4. Missing nutrient values remain `null`; never replace unknown values with zero or model-generated guesses.
5. Estimated serving sizes and quantities remain visibly marked as estimates until a qualified human reviewer has reviewed them.
6. AI-assisted review must never be relabelled as human expert review.
7. Unknown/unrecognized dishes must remain a supported outcome. Do not force every image into one of the supported 30 dishes.
8. The existing `VisionProvider` interface and deterministic engine remain the primary seams for extensibility.
9. Do not split the monorepo, replace the framework, change deployment providers or introduce a database just because the agent prefers another stack.
10. All public UI messages continue to be available in English and Bangla.

---

## 5. Approval gates (the agent must stop here)

Continuous autonomy does **not** mean unlimited authority. The agent can implement and test local code continuously, but must pause before any of the following:

- **Production/deployment gate:** deploy, change production secrets, alter production bindings/namespaces, change domains, or modify live Cloudflare resources.
- **Spend gate:** enable paid Cloudflare features, increase paid usage, make real Gemini calls that may incur cost, create paid inference endpoints, or change account-level spend limits. Use mocked/fake providers in automated tests.
- **Dataset/legal gate:** redistribute, publish, train on, or commit any dataset/image whose licence, attribution, terms or individual asset rights are unclear. Prepare a licence audit and ask for approval.
- **Expert-review gate:** mark recipe quantities, nutrient values, safety rules, allergens or health rules as human-expert-approved. Only an actual qualified human reviewer can provide that approval.
- **Data-deletion gate:** delete or overwrite original source data, proposals, approval records, raw datasets, evaluation images, user content or migration history.
- **Public-release gate:** merge to `main`, create/push `v2.0.0`, publish GitHub Release, or make a public claim of measured accuracy or expert validation.

At a gate, the agent must state: what it wants to do, why it is needed, what could change or cost money, the no-cost/local alternative, and the exact approval needed. It must not silently work around the gate.

---

## 6. Phased roadmap

### Phase 0 — Protect the baseline and establish the v2 workspace

**Priority:** mandatory first  
**Depends on:** none  
**Primary outcome:** Safe, isolated development that can be abandoned without losing v1.

**Work**

- Verify `main`, `v1.0.0` tag, GitHub remote and working tree against Section 3.
- Verify `improvement/development` branches from the v1.0.0 commit, not from an unrelated later experimental state.
- If the branch/tag has not been created, stop before application changes and provide exact instructions. Do not guess the intended baseline commit.
- Create or update a concise progress tracker at `docs/plan/SAFEPLATE_V2_PROGRESS.md` with phase status, commit, test results, open risks and gates.
- Record actual baseline checks: `pnpm check`, `pnpm verify` if present, package test counts, build results and current bundle sizes if the scripts support them.

**Deliverables**

- Verified Git safety report.
- `docs/plan/SAFEPLATE_V2_PROGRESS.md`.
- Baseline test/build report.

**Acceptance criteria**

- The original baseline tag still points to the original commit.
- No changes have been made on `main`.
- Development work is isolated to `improvement/development`.
- Baseline commands and any pre-existing failures are documented.

---

### Phase 1 — Finish the existing foundation and documentation debt

**Priority:** high  
**Depends on:** Phase 0  
**Primary outcome:** The repository accurately describes what exists and what is still incomplete.

**Work**

1. Complete the unfinished P4-X04 performance/size-budget work only after inspecting the original task definition and existing scripts. Establish reproducible production build sizes and a reasonable budget from measured baseline values; do not invent arbitrary thresholds.
2. Complete P4-X05 documentation: create a useful root `README.md`, `KNOWN_LIMITATIONS.md` (or the repository's existing preferred docs location), and update the docs index/status board.
3. Fix stale bookkeeping: reconcile the 74-PR / phase-card status with the real Git history; update `BUGS.md` only for verified fixes; do not rewrite historical decisions.
4. Mark the actual state of `TEAM.md`, `SPIKE_RESULTS.md`, `EVAL_REPORT.md` and other promised artifacts. Do not fabricate missing results.
5. Document local setup, Node/pnpm requirements from `package.json`/lockfile, commands, environment variables by name only, development flow, test flow, Cloudflare deployment process and known limitations.
6. Document that current scan results are not a clinically or professionally certified nutrition/food-safety assessment.

**Deliverables**

- Root `README.md`.
- `KNOWN_LIMITATIONS.md` or equivalent.
- Reconciled plan/status documentation.
- Reproducible performance/size baseline and budget.

**Acceptance criteria**

- A new developer can understand the project and run the documented local checks.
- No placeholder evaluation metrics or false expert-approval claims appear.
- Documentation matches real scripts, current code and deployment configuration.
- `pnpm check` and `pnpm verify` (if present) pass.

---

### Phase 2 — Production AI reliability, privacy and cost control

**Priority:** critical  
**Depends on:** Phase 0  
**Primary outcome:** Production requests use an explicitly selected real provider, avoid repeated calls where possible, fail safely and have bounded usage.

**Workstream A: provider configuration and model validation**

- Inspect `apps/api/src/provider.ts`, `wrangler.toml`, `.env.example`, Worker/Node entry points and the current Gemini provider implementation.
- Make provider selection explicit. `mock` must be opt-in for local development/tests and must never silently become the production provider when `AI_PROVIDER` is absent.
- Keep `GEMINI_MODEL` configurable. Verify the exact selected ID against Google's current official model catalogue and image-input documentation. For the audit snapshot's `gemini-3.5-flash-lite`, do not assume it is invalid: the official public catalogue checked on 18 November 2026 lists that exact ID. Run a controlled, explicitly approved staging/API test before declaring it operational.
- Health checks should distinguish process health, configuration health and provider reachability. Do not make every health request incur a paid vision call.
- Keep API keys in platform secrets or local ignored environment files. Never log them or expose them to the browser.

**Workstream B: cache and request lifecycle**

- Wire the existing cache abstraction into the actual Worker and Node production composition roots.
- Use an adapter-based design. A short-lived in-memory cache can remain useful locally, but it is not a durable shared Worker cache.
- Evaluate Cloudflare Workers KV for cache entries only. KV is eventually consistent, so design for occasional cache misses/stale visibility; do not use KV alone for atomic daily budget enforcement.
- Cache keys should include scan kind, normalized MIME, image content hash, provider/model ID, prompt/schema version and any other input that changes the result. Avoid storing raw images if a hash and output record are sufficient.
- Define TTL and invalidation behavior. Never reuse a result across incompatible prompt/model/schema revisions.
- Add tests proving Worker and Node composition roots supply the expected cache/budget dependencies. Test cache hit, miss, expiry, provider-key isolation and invalidation.

**Workstream C: budget guard and durable coordination**

- Retain a safe per-day call/cost ceiling and make the budget behaviour explicit.
- In-memory counters are not a production-wide limit. If global atomic enforcement is required, evaluate a Cloudflare Durable Object with strongly consistent transactional storage. Do not use eventual-consistency KV for a correctness-critical counter.
- Inspect current Free-plan limits/pricing and required Wrangler bindings before changing Cloudflare resources. Code and test adapters locally first. Stop at the spend/production gate before provisioning or deploying.
- If durable enforcement is not configured, fail closed or clearly report that production budget enforcement is not guaranteed; do not claim that an in-memory counter is global.

**Workstream D: errors, retries and upload validation**

- Add bounded retry with exponential backoff and jitter for transient network errors, 429 and retryable 5xx responses. Respect `Retry-After` when supplied. Avoid retrying non-retryable validation/authentication errors. Bound total attempts and elapsed time.
- Do not automatically fall back to mock output. If a local provider is not running or available, return a clear safe error.
- Validate upload file size and type in the browser before sending; validate actual file signatures/magic bytes on the server instead of trusting only the declared MIME type. Keep the existing body-size boundary and image format allowlist.
- Add tests for invalid MIME/signature mismatch, oversized payloads, provider timeout, 429, retry exhaustion, cache hit and budget exhaustion.

**Deliverables**

- Explicit fail-fast provider configuration.
- Production cache adapter wired through Worker and Node entry points.
- Correctly scoped budget design and tested adapter.
- Bounded retry/error handling.
- Client and server upload validation.
- `docs/PRODUCTION_RELIABILITY.md` documenting what is guaranteed and what still requires Cloudflare configuration.

**Acceptance criteria**

- Missing `AI_PROVIDER` cannot silently run mock data in production.
- Unit/integration tests prove Worker and Node composition use the intended dependencies.
- No health check triggers a paid vision call.
- Cache behaviour is versioned and tested.
- The budget implementation does not claim cross-instance atomicity unless backed by a suitable strongly consistent mechanism.
- No secret, image or health profile is written to logs.
- `pnpm check` and `pnpm verify` pass.

---

### Phase 3 — Build a real, reproducible vision evaluation benchmark

**Priority:** critical for product claims  
**Depends on:** Phase 2 provider contract and reliability; evaluation scaffolding may begin earlier  
**Primary outcome:** Measure recognition instead of guessing whether the model works.

**Potential public dataset sources to inspect**

These are candidates, not automatic approvals. The agent must inspect actual archives/metadata, current terms, per-image provenance, label mapping, duplicate risk and redistribution restrictions before downloading, training, committing or publishing any image.

| Candidate                                                                                   | Public page says                                                                                                                               | Intended use / caution                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [FoodBD v2 — Mendeley Data](https://data.mendeley.com/datasets/xh3ghf3jbg/2)                | 3,523 smartphone images, 67 categories; 1,837 images also include nutrition estimates; CC BY 4.0                                               | Strong first candidate for a Bangladesh food-image benchmark. Nutrition annotations are dataset estimates, not automatically laboratory truth or approval for SafePlate's recipe database. Preserve required attribution.              |
| [BD-Food33 — Mendeley Data](https://data.mendeley.com/datasets/8wt48bjmx3/1)                | 1,200+ images, 33 categories; CC0 1.0                                                                                                          | Inspect source metadata and category mapping. The card describes images gathered from public websites, restaurant sites, blogs and manual capture; record provenance and do not assume every image represents a distinct dish/setting. |
| [Bangladeshi Food — Hugging Face](https://huggingface.co/datasets/tanziro/bangladeshi-food) | Current dataset card describes about 2,273 image URLs and about 604 classes; dataset is CC BY-SA 4.0 with attribution/share-alike requirements | Large taxonomy but sparse per class and multi-license provenance. The card says images carry attribution/source fields. Evaluate licence implications and availability before using or redistributing derivatives.                     |

**Work**

1. Refactor `tools/src/eval-run.ts` only as needed so it can evaluate a provider through a local/test harness as well as the deployed API. CI must not call paid external models.
2. Create an evaluation manifest schema with image ID/path, canonical label, split, source, licence, attribution, original URL/DOI, image conditions and notes. Do not put private image bytes in Git.
3. Keep a reproducible local dataset directory outside source control or under a documented ignored path. Commit only licence-cleared metadata/manifests that can legally be published.
4. Map dataset labels to SafePlate's catalogue with a human-reviewable mapping file. Keep ambiguous labels as unmapped; do not silently merge distinct foods.
5. Deduplicate exact and near-duplicate images across sources and prevent image leakage between tuning/development and final test splits.
6. Create separate evaluation tasks for dish recognition, packaged-label OCR and spoilage-sign detection. Do not combine their metrics.
7. Report top-1 accuracy, top-3 accuracy, macro-F1, per-class precision/recall/support, confusion matrix, unknown rejection performance, confidence threshold behaviour and latency. For OCR, measure field-level exact/normalized accuracy and null/abstention behaviour. For spoilage signs, measure per-sign precision/recall only when valid labelled data exists.
8. Include a clear statement of dataset size, class imbalance, supported classes, excluded classes, licence and evaluation limitations.
9. Commit a reproducible `docs/EVAL_REPORT.md`, including model/provider, model version, prompt/schema version, date, run configuration and limitations.

**Acceptance criteria**

- The evaluation can run locally and reproducibly without a deployed endpoint.
- The benchmark includes only assets with documented permitted use.
- Metrics include support counts and do not hide class imbalance.
- Synthetic fixtures are not presented as real-world accuracy evidence.
- No performance claim is published beyond what the test set supports.

---

### Phase 4 — Hybrid model comparison: cloud Gemini vs local vision model

**Priority:** high  
**Depends on:** Phase 3 benchmark  
**Primary outcome:** Make an evidence-based model decision while preserving the Cloudflare deployment.

**Work**

1. Inspect current local hardware and runtime constraints rather than assuming model fit. Record available VRAM/RAM, runtime versions and quantization support.
2. Select at most two current vision-capable open-weight candidates after checking official model cards, licence, image input support, language capability, structured-output behaviour, model size and actual VRAM needs.
3. Keep local weights and downloaded checkpoints outside Git.
4. Implement a local provider adapter behind the current provider interface. It must be optional and must not change the production Worker configuration.
5. Run the same evaluation manifest, prompt intent, output schema and preprocessing across the cloud and local paths. If exact prompt parity is impossible, explain the difference.
6. Compare top-1/top-3 and macro-F1, per-class performance, unknown rejection, JSON/schema validity, retry rate, p50/p95 latency, local VRAM/RAM, approximate cost per 1,000 scans, privacy characteristics and operational complexity.
7. Test Bangla and English label observations separately where the dataset permits.
8. Recommend one of: (a) cloud Gemini remains production primary; (b) local model is useful only for offline/local use; (c) local model deserves a separately hosted pilot. Do not implement (c) without approval.

**Acceptance criteria**

- Both providers run through a common evaluation contract.
- No local model is promoted based only on a few cherry-picked images.
- Licence and resource requirements are documented.
- Cloudflare production remains unchanged pending explicit approval.
- `docs/MODEL_COMPARISON.md` records results and a recommendation.

---

### Phase 5 — Separate recognition catalogue from approved nutrition knowledge

**Priority:** high  
**Depends on:** Phase 3 label analysis; can be designed after Phase 2  
**Primary outcome:** Recognize a wider range of foods without pretending that all recognized foods have reliable nutrition data.

**Work**

- Introduce a distinct recognition catalogue/taxonomy (names, Bangla names, English aliases, regional aliases, category and provenance) separate from the nutrition database.
- Keep the currently approved nutrition set at its current scope until source-backed records are added and reviewed.
- Allow the vision model to return up to three candidates plus an explicit unknown/unrecognized outcome. Do not force a supported nutrition `dishId` for every image.
- Show candidate confidence/uncertainty transparently and let the user confirm or correct the dish.
- If a dish is recognized but not in the approved nutrition database, display “identified; nutrition data unavailable” and do not calculate nutrition from the image or model-generated ingredients.
- Avoid embedding an ever-growing full catalogue into every prompt. Evaluate category retrieval/candidate preselection only if it can preserve recall and be measured on the benchmark.
- Add versioned catalogue IDs and aliases; keep Bangla and English names linked to a stable canonical ID.

**Acceptance criteria**

- Recognition taxonomy can grow without changing the nutrition database automatically.
- Unknown and unsupported-but-recognized dishes have distinct, understandable UI states.
- No unapproved catalogue item can reach deterministic nutrition calculations.
- Top-1/top-3/unknown-rejection metrics do not regress beyond an agreed tolerance.

---

### Phase 6 — Strengthen nutrition knowledge and provenance

**Priority:** high, but human-review dependent  
**Depends on:** Phase 1 documentation and Phase 5 data boundaries  
**Primary outcome:** Improve coverage without sacrificing traceability or honest uncertainty.

**Work**

1. Extend the source schema to capture source title, publisher/authority, source URL/DOI, licence/terms, access date, version, food code/FDC ID, page/table, nutrient basis, preparation state, attribution and verification status.
2. Audit all 21 currently unsourced ingredients. Resolve each against the project's accepted primary references (e.g. Bangladesh Food Composition Table and USDA FoodData Central) only where the food identity, preparation state and measurement basis match.
3. Investigate missing saturated fat and sugar values from source records. Add only values that are explicitly present and correctly mapped. Preserve nulls otherwise.
4. Check unit conversions, per-100g basis, raw/cooked distinction, edible portion, moisture and food-code mappings. Preserve exact provenance at nutrient level where the existing schema supports it.
5. Keep ingredient facts separate from recipe/serving estimates. Do not infer exact grams or serving weights from photos or model output.
6. Add review provenance statuses such as `source_verified`, `ai_assisted_review`, `human_review_pending` and `human_reviewed` if a schema change is justified. Do not use a status that implies a professional reviewed an item when that did not happen.
7. Generate review queues for a qualified human nutrition professional. Keep all current estimates visibly labelled until reviewed.
8. Treat FoodBD nutrition fields as dataset annotations/estimates with their own provenance; do not silently promote them to laboratory measurements or SafePlate-verified nutrient truth.

**Acceptance criteria**

- Every non-null nutrient value has a traceable source and compatible measurement basis.
- Missing data remains null.
- All estimates remain labelled as estimates.
- No AI-only review is called human expert approval.
- Source licences/attribution are recorded and checked before redistribution.
- Data verification, normalization, runtime drift and golden tests pass.

---

### Phase 7 — Food safety and allergen correctness

**Priority:** high  
**Depends on:** Phase 3 evaluation capability and Phase 6 provenance model  
**Primary outcome:** Reduce misleading safety/allergen matches and close or remove dead feature paths.

**Work**

- Create a test corpus of positive, negative and ambiguous allergen-label phrases in English, Bangla script and romanized Bangla. Use source-labelled examples; do not generate a claimed accuracy figure from synthetic tests alone.
- Fix broad-token false positives (e.g. generic `flour`, `kheer/payesh`, generic বাদাম) using ingredient-context-aware canonical terms, phrase matching and clear uncertainty. Be careful not to create false negatives when removing broad terms.
- Evaluate Bangla inflections and OCR uncertainty. Keep the difference between “declared by manufacturer”, “detected in text” and “not detected” explicit.
- Implement “may contain”/trace advisory parsing only for explicit label statements. If text is unreadable or ambiguous, show an uncertainty warning; never turn absence of detection into “allergen-free”.
- Review all deterministic safety/health thresholds and source citations. Keep heuristics identified as heuristics until a qualified professional validates them.
- For spoilage signs, use the vision model output only as a limited visual observation; do not claim food is safe/unsafe from a photo. Add per-signal confidence/uncertainty only if the contract and benchmark can support it.
- Decide the storage-duration path: implement end-to-end only if appropriate authoritative sources support the rules and the UI reliably captures the required context; otherwise remove or clearly disable the unused trigger with tests. Do not invent time limits.

**Acceptance criteria**

- Allergen matching tests cover false positives, false negatives, Bangla script, romanization, negation/advisories and OCR uncertainty.
- “May contain” is distinct from confirmed ingredient detection.
- Missing/uncertain evidence never produces a clean bill of safety.
- Safety and health heuristics are labelled and sourced honestly.
- No unsupported storage-time threshold is introduced.

---

### Phase 8 — Frontend journey, recovery and accessibility

**Priority:** medium-high  
**Depends on:** stable contracts from Phases 2, 5 and 7  
**Primary outcome:** A scan journey users can understand, resume and correct.

**Work**

1. Persist only the minimum scan result state needed to recover `/confirm` and `/result` after refresh. Keep health profile data local and never transmit it to the API. Document retention and clear/delete behaviour.
2. Make history entries clickable and reopen prior results safely. Handle missing/expired/incompatible records with a clear message.
3. Add a useful 404 page and fix deep-link/onboarding redirects without breaking intended onboarding.
4. Display candidate confidence/uncertainty in understandable language (not false precision); explain when the model is unsure.
5. Explain the “None of these” path instead of silently reinterpreting the scan as a label.
6. Add upload progress and cancellation where technically reliable; clean up aborted requests and temporary UI state.
7. Validate image size/type before upload and display actionable errors. Keep the server validation from Phase 2 as the security boundary.
8. Consolidate duplicated language controls while preserving access from onboarding/settings.
9. Retain bilingual English/Bangla messages, keyboard support, touch targets, contrast and reduced-motion behaviour.

**Acceptance criteria**

- Refreshing confirm/result routes has a defined recovery path.
- History can reopen and delete/clear records according to the documented policy.
- Unknown routes show a 404 state.
- User understands candidate uncertainty and unsupported nutrition coverage.
- Accessibility and i18n tests pass.

---

### Phase 9 — Automated QA, browser E2E and performance hardening

**Priority:** high before release  
**Depends on:** Phases 2–8  
**Primary outcome:** Protect the improved application against regressions.

**Work**

- Add Vitest coverage reporting using a provider compatible with the existing Vitest version. Establish a measured baseline first; set practical thresholds for critical packages instead of arbitrary 100% coverage.
- Add a small Playwright browser smoke suite for the highest-value paths: welcome/onboarding, demo scan, upload validation, candidate confirmation, result, history reopen, settings/profile privacy and 404.
- Keep CI deterministic: mock AI and avoid live paid Gemini calls. Real-provider evaluation remains a separate explicitly triggered local/staging operation.
- Add regression tests for every bug fixed during this programme.
- Add bundle-size and Worker build-size budgets based on Phase 1 measurements. Document exceptions and intentional changes.
- Test API body limits, malformed images, request timeouts, retry exhaustion, cache consistency assumptions and rate/budget exhaustion.
- Run `pnpm check`, `pnpm verify` (if available), production builds, coverage and E2E. Record exact commands, counts and outputs in the progress report.
- Review Cloudflare Worker compatibility and resource limits without deploying.

**Acceptance criteria**

- All unit/integration suites pass.
- Browser smoke suite passes in CI or a documented local environment.
- No external AI call is required for normal CI.
- Coverage and bundle reports are committed or attached as reproducible artifacts.
- No known critical privacy, upload-validation or production-configuration regression remains.

---

### Phase 10 — Release candidate, v2.0.0 and controlled deployment

**Priority:** release gate  
**Depends on:** Phases 0–9  
**Primary outcome:** A reviewed, documented release that can be rolled back to v1.

**Work**

1. Produce a release-candidate summary: completed phases, open issues, test results, evaluation results, provider/model, knowledge coverage, data limitations, licence summary, and deployment requirements.
2. Compare v2 against the v1.0.0 baseline. Clearly distinguish improvements demonstrated by tests/metrics from planned or unverified work.
3. Confirm that the v1.0.0 tag and GitHub Release are still intact.
4. Ask the user to review/approve the release candidate. Do not merge or deploy automatically.
5. After approval: merge `improvement/development` into `main` with a merge commit, run final checks on `main`, create annotated tag `v2.0.0`, push the approved branch/tag, and publish the GitHub Release with factual notes.
6. Deploy to Cloudflare only after explicit deployment approval. Use a staging/preview environment first where available, verify health and a controlled scan, then proceed with production only with approval.
7. Document rollback to v1.0.0 and the exact Worker rollback procedure supported by the current Cloudflare deployment workflow.

**Acceptance criteria**

- v1.0.0 is preserved.
- v2.0.0 points to the reviewed final release commit.
- Release notes and `KNOWN_LIMITATIONS.md` are accurate.
- `pnpm check`, data verification, builds, coverage and browser E2E pass.
- Evaluation claims match the committed report and permitted dataset use.
- Production deployment occurs only after user approval.

---

## 7. Dependencies and execution order

The recommended order is:

```text
Phase 0: Git safety / baseline
   └── Phase 1: docs + existing P4 completion
          └── Phase 2: production reliability
                 └── Phase 3: real image evaluation
                        ├── Phase 4: cloud vs local model comparison
                        ├── Phase 5: recognition/nutrition catalogue separation
                        └── Phase 7: safety/allergen evaluation
Phase 6: nutrition provenance and coverage (can begin source audit after Phase 1;
        data changes depend on source verification and human review)
Phases 5–8: integrate frontend changes after contracts are agreed
Phase 9: full QA after implementation phases
Phase 10: release only after user approval
```

The agent may work on independent documentation, tests or research in parallel only when no phase dependency is violated. It must not skip a phase's acceptance criteria merely to keep moving.

### Balanced-scope rule

Do not interpret “balanced” as “add every possible feature”. Stabilize the current product, measure it, then expand. Defer fine-tuning, a large 600-class catalogue, user accounts, remote inference hosting, large databases and new deployment platforms unless measured evidence demonstrates a need and the user approves the scope.

---

## 8. Progress tracking format

Maintain `docs/plan/SAFEPLATE_V2_PROGRESS.md` with this structure:

```md
# SafePlate v2.0.0 Progress

Updated: YYYY-MM-DD
Branch: improvement/development
Baseline tag: v1.0.0

| Phase | Status                                         | Commit | Checks | Notes / blockers |
| ----- | ---------------------------------------------- | ------ | ------ | ---------------- |
| 0     | Not started / In progress / Complete / Blocked |        |        |                  |

## Current phase

## Completed work

## Test results

## Decisions and evidence

## Approval gates awaiting the user

## Risks / known limitations

## Next phase
```

Use only these phase statuses: `Not started`, `In progress`, `Complete`, `Blocked`, `Deferred by user`. A phase is `Complete` only when its acceptance criteria are met.

---

## 9. Master prompt for OpenCode / Qoder

Copy this prompt into the coding agent after placing this file at the repository root or in the path you choose. The prompt is intentionally agent-neutral so the same project instructions work in Qoder or OpenCode.

```text
You are the implementation agent for SafePlate v2.0.0.

Read SAFEPLATE_V2_IMPROVEMENT_PLAN.md completely before changing code. Treat it as the governing implementation specification. Also inspect the current repository, package scripts, existing architecture documents, the supplied audit if present, and the actual Git state. The plan is repository-specific, but current source code and tests are the truth if anything has changed since the audit.

USER PREFERENCES
- Balanced delivery: prioritize reliability, measured value and working milestones, not artificial deadlines.
- Hybrid AI: keep the existing Gemini cloud path for the current Cloudflare deployment; implement local vision-model comparison behind the provider abstraction. Do not make the laptop a production dependency.
- Keep the current Cloudflare Workers + web deployment. Do not migrate platforms.
- Work continuously through phases without asking after every small task. Stop only at the explicit approval gates in the plan.

MANDATORY SAFETY RULES
1. Work only on `improvement/development`. Never implement on `main`.
2. Before edits, inspect `git status --short --branch`, current branch, latest commit, tags and remotes. Verify `v1.0.0` points to the intended pre-improvement commit. If the branch/tag safety conditions are not met, do not edit application files; report exact corrective steps.
3. Never reset, clean, force-push, rewrite history, delete tags, discard user changes or overwrite unknown files.
4. Do not merge to `main`, create/push `v2.0.0`, publish a GitHub Release or deploy production. Those require explicit user approval.
5. Do not provision paid resources, change production Cloudflare bindings/secrets, or make paid live Gemini calls without approval. Automated tests must use mocks/fakes.
6. Do not download, commit, train on, redistribute or publish a dataset unless its licence, attribution, terms and provenance have been checked. Stop if unclear.
7. Do not invent nutrition values, ingredient quantities, expert review, safety thresholds, model metrics, benchmark results or dataset licensing facts. Preserve nulls and estimate labels.
8. Never send health profiles to the API or model. Do not log secrets, API keys, images or private user data.
9. Never silently switch to mock output in production, and never claim a local model is a production fallback unless it is actually hosted, secured, tested and approved.

CONTINUOUS EXECUTION PROTOCOL
- Start with Phase 0 and follow the plan's dependency order.
- For each phase: inspect relevant code; make a concise implementation checklist; implement the phase rather than merely proposing it; add or update tests; run targeted tests; fix failures caused by your changes; run `pnpm check` and `pnpm verify` when appropriate; update docs and `docs/plan/SAFEPLATE_V2_PROGRESS.md`; review the diff; commit the completed milestone with a descriptive message; then continue to the next unblocked phase.
- Do not mark a phase Complete until every acceptance criterion is satisfied. Mark it Blocked with evidence when a gate or missing input prevents completion.
- If a command fails because of a pre-existing issue, compare against the baseline, isolate whether your changes caused it, and report it. Do not hide or casually alter unrelated code to force a green result.
- Prefer minimal, incremental changes that fit the current architecture. Do not add dependencies unless needed; explain why and check compatibility/licence/size.
- Keep tests deterministic. Do not call paid model APIs in unit tests or CI.
- Do not silently change API contracts. Add compatibility tests and update the web client when a contract change is justified.
- Do not add arbitrary data or model capabilities just to increase counts.

REPORTING
At the end of each phase, report: files changed, behaviour added/fixed, commands run and exact results, commits created, remaining limitations, and whether the next phase is unblocked. Keep the progress file current. Continue automatically unless an explicit approval gate is reached. At a gate, stop and ask for only the specific approval required, while preserving all completed safe work.
```

---

## 10. Phase-specific prompts

Use the Master Prompt once. For normal continuous execution, the agent should proceed through these prompts internally in order. If the agent needs a narrower task or loses context, paste the relevant phase prompt.

### Prompt — Phase 0: baseline and Git safety

```text
Execute Phase 0 of SAFEPLATE_V2_IMPROVEMENT_PLAN.md only. Inspect actual Git state, verify the v1.0.0 tag and improvement/development branch relationship, and capture baseline test/build/verification results. Do not modify application code. Do not create or move tags, push, reset, clean, stash, merge or switch branches without reporting the exact proposed action first. Create/update docs/plan/SAFEPLATE_V2_PROGRESS.md only if the safe branch conditions are already satisfied. Mark Phase 0 complete only when all its acceptance criteria are evidenced.
```

### Prompt — Phase 1: foundation and documentation

```text
Execute Phase 1. Inspect the original P4-X04/P4-X05 task definitions and the current package scripts before implementing. Finish the measured performance/size budget, README, known limitations and stale plan bookkeeping. Reconcile every claimed status against code and Git history. Do not fabricate eval results, expert approval or deployment instructions. Run pnpm check and pnpm verify if available. Update the progress file, review the diff and commit the completed milestone.
```

### Prompt — Phase 2: production reliability

```text
Execute Phase 2. Trace the full API composition roots for Worker and Node before changing anything. Fix explicit provider selection, cache wiring, budget semantics, bounded retries and upload validation while preserving the provider interface and client-side analysis/privacy boundary. Verify the configured Gemini ID against current official documentation; do not replace gemini-3.5-flash-lite solely because the supplied audit questioned it. Use mocked providers in tests. Design KV only for appropriate cache semantics and use a strongly consistent design such as Durable Objects if atomic global budget enforcement is required. Do not provision resources, change secrets, make live paid calls or deploy; stop at the applicable approval gate. Add tests for the actual production composition roots and update reliability documentation.
```

### Prompt — Phase 3: evaluation benchmark

```text
Execute Phase 3. Inspect candidate public datasets and their actual metadata/licences before downloading or using any images. Build a reproducible evaluation manifest and local runner that can call mock/local providers and an explicitly triggered provider adapter without requiring a deployed API. Keep raw photos and weights out of Git. Separate dish recognition, label OCR and spoilage-sign evaluation. Add per-class support and appropriate metrics, unknown rejection and latency. Do not call external paid APIs without approval. Produce docs/EVAL_REPORT.md only from a real completed run; otherwise document the benchmark as not yet run. Stop for licence uncertainty.
```

### Prompt — Phase 4: local/cloud model comparison

```text
Execute Phase 4 after the evaluation set exists. Check current official model cards, licences, image-input support, language support and hardware requirements. Select no more than two local candidates. Implement a local adapter behind the existing VisionProvider seam and run the same manifest as Gemini. Measure accuracy, JSON validity, unknown rejection, latency, memory/VRAM and estimated cost. Keep local weights outside Git and leave the Cloudflare production provider unchanged. Do not create a hosted inference endpoint or alter production configuration. Write docs/MODEL_COMPARISON.md with measured results and limitations.
```

### Prompt — Phase 5: recognition/nutrition separation

```text
Execute Phase 5. Separate the recognition taxonomy from the approved nutrition dataset without broadening nutrition eligibility. Preserve the explicit unknown outcome, maximum candidate count and user confirmation. A recognized-but-unsupported food must show nutrition unavailable; do not derive nutrition from the image or LLM. Add contract, engine integration and UI tests, and benchmark regression checks. Avoid arbitrary catalogue expansion and prompt bloat. Update documentation and commit.
```

### Prompt — Phase 6: nutrition provenance

```text
Execute Phase 6. Audit each unsourced ingredient and missing nutrient against the project's accepted primary sources. Extend source metadata only where needed and preserve nutrient basis, food codes, page references, licence and attribution. Do not guess values, convert AI estimates into facts, mark any entry human-reviewed without a qualified person's actual review, or overwrite raw/proposal/approval records. Keep missing values null. Generate a human-review queue and stop before any irreversible data replacement or expert-approval claim. Run data verification and golden tests.
```

### Prompt — Phase 7: allergen and safety correctness

```text
Execute Phase 7. Build or inspect a source-labelled test corpus before changing matching logic. Address broad keyword false positives without creating untested false negatives. Distinguish manufacturer-declared allergens, text-detected ingredients, trace advisories and not-detected states. Do not label any product allergen-free based only on absence of a text match. Verify every safety threshold/source claim and keep heuristics explicitly labelled. Implement storage rules only when authoritative evidence and reliable UI context exist; otherwise remove/disable dead logic safely. Add tests and bilingual messages.
```

### Prompt — Phase 8: frontend recovery and UX

```text
Execute Phase 8. Trace current routes, router state, local profile/history stores and privacy tests before changing persistence. Implement refresh recovery, clickable history, 404, understandable confidence/uncertainty, explicit None-of-these handling, upload progress/cancel and early client validation. Store only the minimum data needed and preserve the rule that the health profile never leaves the browser. Maintain English/Bangla parity, keyboard access, contrast and touch targets. Add focused component/state tests and update docs.
```

### Prompt — Phase 9: QA and performance

```text
Execute Phase 9. Add compatible Vitest coverage reporting and a minimal Playwright browser smoke suite for critical journeys. Establish measured coverage and bundle baselines before setting practical thresholds. CI must use mock AI and must not call paid services. Add regressions for bugs fixed in prior phases. Run pnpm check, pnpm verify, production builds, coverage and browser E2E; record exact outcomes. Do not deploy.
```

### Prompt — Phase 10: release candidate only

```text
Prepare the Phase 10 release-candidate report, but do not merge, tag, push, publish or deploy. Verify the v1.0.0 tag remains intact. Compare v2 work against the original baseline and summarize completed phases, commits, tests, benchmark results, limitations, data-source/licence status, production configuration requirements and rollback instructions. Ask the user to approve the release. Only after explicit approval may the release steps be performed.
```

---

## 11. Definition of done for v2.0.0

SafePlate v2.0.0 is ready for release only when all required items below are true:

- [ ] v1.0.0 and its GitHub Release remain available and unchanged.
- [ ] All accepted v2 changes are on `improvement/development`; no experimental changes were made directly on `main`.
- [ ] Production provider configuration is explicit and verified; mock cannot silently run in production.
- [ ] Production cache wiring and its consistency/TTL limits are documented and tested.
- [ ] Budget enforcement limitations are explicit; global atomic enforcement is not claimed without a strongly consistent implementation.
- [ ] Client and server upload validation are tested.
- [ ] Real-image evaluation report exists, or product claims clearly state that recognition accuracy remains unmeasured. A full public accuracy claim is not allowed without the report.
- [ ] Cloud/local comparison is reproducible, or local evaluation is explicitly deferred with reasons.
- [ ] Recognition taxonomy and approved nutrition knowledge are separate.
- [ ] Every non-null nutrition fact has traceable provenance; estimates and unavailable values remain obvious.
- [ ] Allergen/safety limitations are documented; no unsupported safety assurance is made.
- [ ] Core frontend recovery and accessibility tests pass.
- [ ] Unit/integration, data verification, build, coverage and browser smoke checks pass.
- [ ] README and known-limitations documentation match the shipped code.
- [ ] User has reviewed and approved the release candidate and any production deployment.

A checkbox must not be marked complete merely because code was written. Evidence is required.

---

## 12. Reference links and research notes

These sources were checked while preparing this plan on 18 November 2026. Re-check them before a later deployment because model catalogues, dataset cards, terms and Cloudflare limits can change.

### Official product/platform documentation

- [Google Gemini API — Models](https://ai.google.dev/gemini-api/docs/models): current model catalogue; included `gemini-3.5-flash-lite` at the time of this plan.
- [Cloudflare — Choosing a data or storage product](https://developers.cloudflare.com/workers/platform/storage-options/): KV is suited to read-heavy caching; Durable Objects provide globally unique coordination and transactional strongly consistent storage.
- [Cloudflare — Workers KV consistency FAQ](https://developers.cloudflare.com/kv/reference/faq/): KV is eventually consistent; do not use it as the sole atomic global counter.
- [Cloudflare — Workers KV limits](https://developers.cloudflare.com/kv/platform/limits/): re-check free/paid limits before provisioning.
- [Cloudflare — Durable Objects](https://developers.cloudflare.com/durable-objects/): platform details and plan limits; review before creating a binding.

### Dataset candidates (not pre-approved)

- [FoodBD v2, DOI 10.17632/xh3ghf3jbg.2](https://data.mendeley.com/datasets/xh3ghf3jbg/2): card reports 3,523 images, 67 categories, 1,837 images with nutrition estimates and CC BY 4.0.
- [BD-Food33, DOI 10.17632/8wt48bjmx3.1](https://data.mendeley.com/datasets/8wt48bjmx3/1): card reports 1,200+ images, 33 categories and CC0 1.0; inspect image provenance and archive contents.
- [Bangladeshi Food dataset card](https://huggingface.co/datasets/tanziro/bangladeshi-food): card describes a CC BY-SA 4.0 distribution with row-level attribution/source metadata; verify current files and obligations.

---

## 13. Final instruction

The goal is not to make SafePlate look more advanced by increasing the number of dishes, AI models or features. The goal is to make the existing product **more dependable, measurable, transparent and recoverable** while preserving the working v1.0.0 release. When evidence is missing, expose the limitation rather than filling the gap with a guess.
