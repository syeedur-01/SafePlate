# Deploying the SafePlate API

The API (`apps/api`) is a plain Hono app with two entries: `src/worker.ts` for Cloudflare Workers (default) and `src/node.ts` for local dev and the Render fallback. Commands below were checked against the installed Wrangler 4.158.0 and the Render web-service docs; if a command name has changed since, fix this file.

## 1. Set the Gemini key

Keys are never committed. Set the key as a Worker secret:

```
pnpm --filter @sp/api exec wrangler secret put GEMINI_API_KEY
```

Wrangler prompts for the value. The value is stored by Cloudflare, not in `wrangler.toml`.

## 2. Set the plain vars

`GEMINI_MODEL` and `ALLOWED_ORIGIN` are vars, not secrets:

- `GEMINI_MODEL`: the model name from the current Gemini API docs (do not invent one; the model list changes).
- `ALLOWED_ORIGIN`: the exact origin of the deployed web app, for example `https://safeplate.pages.dev`. No trailing slash, no wildcard.

Edit the `[vars]` block in `apps/api/wrangler.toml`, or set them in the Cloudflare dashboard for the Worker. `AI_PROVIDER = "gemini"` is already set there.

## 3. Deploy

```
pnpm install
pnpm check
pnpm --filter @sp/api exec wrangler deploy
```

Wrangler prints the Worker URL. Record it for step 4.

## 4. Smoke test

Check health:

```
curl -i https://<worker-url>/api/health
# expect 200 and {"ok":true,"version":"..."}
```

Check a scan with a real photo (the request never carries the health profile):

```
BASE64=$(base64 -w 0 photo.jpg)
curl -i https://<worker-url>/api/scan \
  -H 'content-type: application/json' \
  --data "{\"kind\":\"dish\",\"imageBase64\":\"$BASE64\",\"mimeType\":\"image/jpeg\",\"context\":{\"place\":\"home\",\"storage\":\"unknown\",\"hoursSinceCooked\":null}}"
```

Expect 200 with a `ScanResult`. A 502 `ai_unavailable` or `ai_invalid_output` means the key or model var is wrong. A repeated identical image returns `cached: true` and does not consume the daily AI budget.

## 5. Rollback

Roll back to the previous deployment:

```
pnpm --filter @sp/api exec wrangler rollback
```

Or to a specific version (list them in the Cloudflare dashboard, Deployments tab):

```
pnpm --filter @sp/api exec wrangler rollback <version-id>
```

Alternative: redeploy the previous release tag.

```
git switch --detach <previous-tag>
pnpm install
pnpm --filter @sp/api exec wrangler deploy
```

## 6. Render fallback

Use this only if the Workers free plan fails the CPU or payload test. Render runs the Node entry and needs the same environment.

1. In Render, create a **Web Service** from this repository. Leave the root directory at the repo root (monorepo).
2. Build command: `pnpm install --frozen-lockfile --prod=false` (the start command uses `tsx`, a root dev dependency).
3. Start command: `pnpm exec tsx apps/api/src/node.ts`
4. Environment variables (Settings > Environment):
   - `AI_PROVIDER=gemini`
   - `GEMINI_API_KEY=<the key>` (mark it as a secret in the Render UI)
   - `GEMINI_MODEL=<model from the current Gemini docs>`
   - `ALLOWED_ORIGIN=https://<deployed-web-app-origin>`
   - Render supplies `PORT`; `src/node.ts` reads it and binds to `0.0.0.0`. Do not hardcode a port.
5. Deploy, then repeat the smoke test from step 4 with the Render URL.

The scan cache and the daily AI budget are in memory. They reset on every Worker restart and on every Render deploy; that is acceptable for the MVP (best-effort quota protection).
