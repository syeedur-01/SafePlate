import { describe, it, expect } from 'vitest';
import { ApiErrorSchema, ScanResultSchema } from '@sp/contracts';
import {
  MockProvider,
  AiUnavailableError,
  AiInvalidOutputError,
  RateLimitedError,
  MemoryScanCache,
  createBudgetGuard,
  type VisionProvider,
} from '@sp/ai';
import { createApp } from '../src/app';
import type { AppConfig } from '../src/config';

const IMG = 'Z'.repeat(300);
const body = (over: object = {}) =>
  JSON.stringify({
    kind: 'dish',
    imageBase64: IMG,
    mimeType: 'image/jpeg',
    context: { place: 'home', storage: 'unknown', hoursSinceCooked: null },
    ...over,
  });
const post = (app: ReturnType<typeof createApp>, b: string) =>
  app.request('/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: b,
  });
const dishes = [{ id: 'kacchi-biryani', name_en: 'Kacchi Biryani', name_bn: '', aliases: [] }];
const cfg = (provider?: VisionProvider, extra: Partial<AppConfig> = {}): AppConfig => ({
  allowedOrigin: 'http://x',
  maxBodyBytes: 2_000_000,
  provider,
  dishes,
  ...extra,
});
const throwing = (e: Error): VisionProvider => ({
  name: 't',
  analyze: async () => {
    throw e;
  },
});

describe('POST /api/scan', () => {
  it('returns a valid ScanResult with the mock provider', async () => {
    const res = await post(createApp(cfg(new MockProvider())), body());
    expect(res.status).toBe(200);
    expect(ScanResultSchema.safeParse(await res.json()).success).toBe(true);
  });
  it('rejects invalid JSON and a smuggled profile with 400', async () => {
    const app = createApp(cfg(new MockProvider()));
    expect((await post(app, '{oops')).status).toBe(400);
    const res = await post(app, body({ profile: { conditions: ['diabetes'] } }));
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(ApiErrorSchema.safeParse(JSON.parse(text)).success).toBe(true);
    expect(text).not.toContain('diabetes');
  });
  it('never echoes the image', async () => {
    const res = await post(createApp(cfg(new MockProvider())), body());
    expect(await res.text()).not.toContain(IMG);
  });
  it.each([
    [new RateLimitedError('x'), 429, 'rate_limited'],
    [new AiUnavailableError('x'), 502, 'ai_unavailable'],
    [new AiInvalidOutputError('x'), 502, 'ai_invalid_output'],
    [new Error('secret detail'), 500, 'internal'],
  ] as const)('maps %s', async (err, status, code) => {
    const res = await post(createApp(cfg(throwing(err))), body());
    expect(res.status).toBe(status);
    const j = await res.json();
    expect(j.error.code).toBe(code);
    expect(JSON.stringify(j)).not.toContain('secret detail');
  });
  it('answers 503 when no provider is configured', async () => {
    expect((await post(createApp(cfg(undefined)), body())).status).toBe(503);
  });
});

const counting = (inner: VisionProvider) => {
  const state = { calls: 0 };
  const provider: VisionProvider = {
    name: inner.name,
    analyze: async (req, ctx) => {
      state.calls += 1;
      return inner.analyze(req, ctx);
    },
  };
  return { provider, calls: () => state.calls };
};

describe('POST /api/scan cache and budget', () => {
  it('serves a repeated image from cache without calling the provider again', async () => {
    const counter = counting(new MockProvider());
    const app = createApp(cfg(counter.provider, { cache: new MemoryScanCache() }));
    const first = await post(app, body());
    expect(first.status).toBe(200);
    expect((await first.json()).cached).toBe(false);
    const second = await post(app, body());
    expect(second.status).toBe(200);
    expect((await second.json()).cached).toBe(true);
    expect(counter.calls()).toBe(1);
  });
  it('refuses a different image once the daily budget is spent but still serves the cache', async () => {
    const counter = counting(new MockProvider());
    const app = createApp(
      cfg(counter.provider, {
        cache: new MemoryScanCache(),
        budget: createBudgetGuard({ maxPerDay: 1, now: () => 0 }),
      }),
    );
    expect((await post(app, body())).status).toBe(200);
    const limited = await post(app, body({ imageBase64: 'Y'.repeat(300) }));
    expect(limited.status).toBe(429);
    const limitJson = await limited.json();
    expect(limitJson.error.code).toBe('rate_limited');
    expect(limitJson.error.message).toBe('Daily AI limit reached');
    const again = await post(app, body());
    expect(again.status).toBe(200);
    expect((await again.json()).cached).toBe(true);
    expect(counter.calls()).toBe(1);
  });
});
