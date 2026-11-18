# Production reliability — AI scan path

What the production scan path guarantees today, and what still requires Cloudflare configuration. Code references are current as of the v2 programme.

## Provider selection

- `AI_PROVIDER` must be set explicitly to `gemini` or `mock` (`apps/api/src/provider.ts`). An unset value **fails fast**; it never silently serves mock fixtures.
  - Worker entry: a broken provider configuration keeps `/api/health` answering (process health) while `/api/scan` returns `503 ai_unavailable` (configuration health). `GET /api/health` reports `provider`, `providerConfigured`, `cache` and `budgetScope` — it never makes an AI call.
  - Node entry: exits at boot on a misconfiguration.
- `GEMINI_API_KEY` is a platform secret (never a var, never logged). `GEMINI_MODEL` is a plain var in `apps/api/wrangler.toml`; verify the exact id against Google's current model catalogue and that the deployed key can actually call it before trusting a deployment.
- The mock provider is only reachable when explicitly selected; it exists for local development and tests.

## Retries and timeouts

- `GeminiProvider` retries transient failures (network errors, `429`, `5xx`) with exponential backoff (500 ms base, ×2 per attempt, up to 250 ms jitter), honouring a `Retry-After` header when present, for a bounded 3 attempts total by default (`packages/ai/src/gemini-provider.ts`).
- Non-retryable failures (client errors such as `400`/`401`/`403`) fail immediately. A `2xx` body without JSON is terminal `ai_invalid_output` — it is never retried and never cached.
- Per-attempt timeout is 25 s via `AbortController`. Output validation is retried once at the `runScan` layer (`packages/ai/src/run-scan.ts`).

## Caching

- Scan results (never photos) are cached under a key of **cache version + provider + model + scan kind + MIME type + SHA-256 of the image bytes**. `SCAN_CACHE_VERSION` (`packages/ai/src/cache.ts`) must be bumped when prompts, output schema or provider behaviour change, so old entries expire instead of being served across incompatible revisions. TTL is 24 h.
- **Worker:** if a KV namespace binding named `SCAN_CACHE_KV` exists, `KvScanCache` is used; otherwise the app falls back to a per-isolate `MemoryScanCache`. The KV binding is **not provisioned** — creating it is a production change requiring approval. KV is eventually consistent: an immediate repeat scan may miss another instance's fresh entry, and expiry is approximate (KV enforces a minimum TTL of 60 s).
- **Node:** in-memory per process.
- Cached responses return `cached: true`; cache hits skip the daily budget.

## Daily budget

- The budget guard (`packages/ai/src/budget.ts`) counts AI calls per UTC day (default 200, `DAILY_AI_BUDGET`).
- **The counter is in-memory.** In the Worker it lives for one isolate (recreated on redeploy, restart or eviction, and per concurrent isolate); in Node it lives for one process. It is **not** a global, cross-instance guarantee.
- If global atomic enforcement is ever required, the supported design is a Cloudflare Durable Object (strongly consistent transactional storage) — not KV, which is eventually consistent and must not be used as a correctness-critical counter. Provisioning a Durable Object namespace is a production change requiring approval. Until then, `GET /api/health` reports `budgetScope: "in-memory"`, and deployments must treat the budget as best-effort cost control, not a hard global limit.

## Upload validation

- Client (`apps/web/src/pages/Scan.tsx`): file type must be JPEG/PNG/WebP and size ≤ 10 MB before upload; violations show a friendly bilingual error without sending anything.
- Server (`apps/api/src/image-signature.ts`): the declared MIME type is verified against the actual byte signature (JPEG `FF D8 FF`, PNG signature, `RIFF…WEBP`); mismatches are rejected with `400`. The `.strict()` request schema, MIME allowlist and body-size limit remain in force.

## Not guaranteed without further approved work

- Global atomic budget enforcement (needs a Durable Object binding and approval).
- Durable shared cache (needs the `SCAN_CACHE_KV` binding and approval); per-isolate memory means cache hit rates reset on every isolate restart.
- The exact deployed model id being callable by the deployed key (verify with a controlled staging call; any live Gemini call costs quota and needs approval).
