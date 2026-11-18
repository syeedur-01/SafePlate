import { describe, it, expect } from 'vitest';
import worker from '../src/worker';

const ENV = { AI_PROVIDER: 'mock' };
const jpegBody = (filler: string) =>
  JSON.stringify({
    kind: 'dish',
    imageBase64: '/9j/4AAQ' + filler,
    mimeType: 'image/jpeg',
    context: { place: 'home', storage: 'unknown', hoursSinceCooked: null },
  });
const scan = (filler: string, env: Record<string, string> = ENV) =>
  worker.fetch(new Request('https://worker/api/scan', { method: 'POST', body: jpegBody(filler) }), {
    ...env,
  });

describe('worker composition root', () => {
  it('serves /api/health with provider and cache information from the environment', async () => {
    const res = await worker.fetch(new Request('https://worker/api/health'), { ...ENV });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      version: expect.any(String),
      provider: 'mock',
      providerConfigured: true,
      cache: 'memory',
      budgetScope: 'in-memory',
    });
  });
  it('keeps /api/health answering when the provider configuration is broken', async () => {
    const res = await worker.fetch(new Request('https://worker/api/health'), {
      AI_PROVIDER: 'gemini',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { providerConfigured: boolean };
    expect(body.providerConfigured).toBe(false);
    const scanRes = await worker.fetch(
      new Request('https://worker/api/scan', { method: 'POST', body: jpegBody('A'.repeat(200)) }),
      { AI_PROVIDER: 'gemini' },
    );
    expect(scanRes.status).toBe(503);
  });
  it('reuses one budget guard across requests in the same isolate', async () => {
    const env = { AI_PROVIDER: 'mock', DAILY_AI_BUDGET: '1' };
    const first = await scan('A'.repeat(200) + 'A', env);
    expect(first.status).toBe(200);
    const second = await scan('A'.repeat(200) + 'B', env);
    expect(second.status).toBe(429);
    const otherIsolate = await scan('A'.repeat(200) + 'B', {
      AI_PROVIDER: 'mock',
      DAILY_AI_BUDGET: '500',
    });
    expect(otherIsolate.status).toBe(200);
  });
  it('serves a repeated image from cache and skips the budget', async () => {
    // Distinct ALLOWED_ORIGIN forces a fresh app for this test despite the shared module cache.
    const env = { AI_PROVIDER: 'mock', DAILY_AI_BUDGET: '1', ALLOWED_ORIGIN: 'http://cache-test' };
    const filler = 'A'.repeat(200) + 'C';
    const first = await worker.fetch(
      new Request('https://worker/api/scan', { method: 'POST', body: jpegBody(filler) }),
      env,
    );
    expect(first.status).toBe(200);
    expect(((await first.json()) as { cached: boolean }).cached).toBe(false);
    const second = await worker.fetch(
      new Request('https://worker/api/scan', { method: 'POST', body: jpegBody(filler) }),
      env,
    );
    expect(second.status).toBe(200);
    expect(((await second.json()) as { cached: boolean }).cached).toBe(true);
    const differentImage = await scan('A'.repeat(200) + 'D', env);
    expect(differentImage.status).toBe(429);
  });
});
