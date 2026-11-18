import dishesJson from '@sp/knowledge/data/normalized/dishes.json';
import { NormalizedDishesFileSchema } from '@sp/contracts';
import { KvScanCache, MemoryScanCache, type KvNamespace } from '@sp/ai';
import type { Hono } from 'hono';
import { createApp } from './app';
import { configFromEnv, type Env } from './config';
import { providerFromEnv } from './provider';

// Workers have no filesystem, so the dish data is bundled into the Worker at build
// time (this JSON import) instead of calling getDishes(), which reads files with
// node:fs at runtime and cannot run here. The schema parse keeps the validated-data
// guarantee that getDishes() provided.
const dishes = NormalizedDishesFileSchema.parse(dishesJson).dishes;

/** Optional Workers KV namespace binding for the scan cache; absent until the user provisions it. */
type WorkerEnv = Env & { SCAN_CACHE_KV?: unknown };

// The app (and with it the cache and budget guard) must live for the whole isolate,
// not per request: a budget or cache created inside fetch() resets on every call.
let cachedApp: { signature: string; app: Hono } | null = null;

function envSignature(env: WorkerEnv): string {
  return JSON.stringify([
    env['AI_PROVIDER'],
    env['GEMINI_MODEL'],
    env['ALLOWED_ORIGIN'],
    env['MAX_BODY_BYTES'],
    env['DAILY_AI_BUDGET'],
    env['ENABLE_SPIKE'],
    env['SCAN_CACHE_KV'] !== undefined,
  ]);
}

function kvBinding(env: WorkerEnv): KvNamespace | null {
  const kv = env['SCAN_CACHE_KV'];
  if (
    typeof kv === 'object' &&
    kv !== null &&
    typeof (kv as KvNamespace).get === 'function' &&
    typeof (kv as KvNamespace).put === 'function'
  ) {
    return kv as KvNamespace;
  }
  return null;
}

function appFor(env: WorkerEnv): Hono {
  const signature = envSignature(env);
  if (cachedApp !== null && cachedApp.signature === signature) return cachedApp.app;

  // Tolerant provider construction: a broken configuration keeps /api/health answering
  // (process health) while /api/scan reports 503 (configuration health).
  let provider;
  let startupError: string | undefined;
  try {
    provider = providerFromEnv(env);
  } catch (error) {
    provider = undefined;
    startupError = error instanceof Error ? error.message : 'AI provider configuration failed';
  }

  const kv = kvBinding(env);
  const app = createApp({
    ...configFromEnv(env),
    provider,
    startupError,
    dishes: dishes.map((dish) => ({
      id: dish.id,
      name_en: dish.name_en,
      name_bn: dish.name_bn,
      aliases: dish.aliases,
    })),
    // KV when a binding exists; otherwise a per-isolate in-memory cache (best effort).
    cache: kv !== null ? new KvScanCache(kv) : new MemoryScanCache(),
  });
  cachedApp = { signature, app };
  return app;
}

/** Cloudflare Workers entry: serves the API app with config from the deployment's environment. */
export default {
  fetch(request: Request, env: WorkerEnv) {
    return appFor(env).fetch(request);
  },
};
