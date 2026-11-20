import { describe, it, expect } from 'vitest';
import { GeminiProvider } from '../src/gemini-provider';
import { AiUnavailableError, RateLimitedError, AiInvalidOutputError } from '../src/errors';

const req = {
  kind: 'dish' as const,
  imageBase64: 'QUJD'.repeat(50),
  mimeType: 'image/jpeg' as const,
  context: { place: 'home' as const, storage: 'unknown' as const, hoursSinceCooked: null },
};
const ctx = {
  catalogue: [
    {
      id: 'kacchi-biryani',
      name_en: 'Kacchi Biryani',
      name_bn: null,
      aliases: ['Kacchi'],
      category: 'Rice & festive specialties',
    },
  ],
};
const reply =
  (text: string, status = 200, headers?: Record<string, string>) =>
  async () =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
      status,
      headers,
    });
/** A provider whose sleeps are recorded instead of really waited, so tests stay fast and deterministic. */
const providerWith = (
  fetchFn: typeof fetch,
  extra: Partial<ConstructorParameters<typeof GeminiProvider>[0]> = {},
) => {
  const slept: number[] = [];
  const provider = new GeminiProvider({
    apiKey: 'K',
    model: 'm',
    fetchFn,
    sleepFn: async (ms) => {
      slept.push(ms);
    },
    jitterFn: () => 0.5,
    ...extra,
  });
  return { provider, slept };
};

describe('GeminiProvider', () => {
  it('sends the model, key header, image and JSON mime type', async () => {
    let url = '';
    let init: RequestInit = {};
    const fetchFn = (async (u: string, i: RequestInit) => {
      url = u;
      init = i;
      return reply('{"a":1}')();
    }) as unknown as typeof fetch;
    const out = await new GeminiProvider({ apiKey: 'K', model: 'm-1', fetchFn }).analyze(req, ctx);
    expect(out).toEqual({ a: 1 });
    expect(url).toContain('/models/m-1:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('K');
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(JSON.stringify(body)).toContain(req.imageBase64);
    expect(JSON.stringify(body)).toContain('image/jpeg');
  });
  it('exposes the model for cache-key scoping', () => {
    expect(new GeminiProvider({ apiKey: 'K', model: 'm-1' }).model).toBe('m-1');
  });
  it('maps 429 to RateLimitedError after exhausting retries', async () => {
    let calls = 0;
    const fetchFn = (async () => {
      calls += 1;
      return reply('x', 429)();
    }) as unknown as typeof fetch;
    const { provider, slept } = providerWith(fetchFn);
    await expect(provider.analyze(req, ctx)).rejects.toThrow(RateLimitedError);
    expect(calls).toBe(3);
    expect(slept).toEqual([625, 1125]);
  });
  it('maps 500 and network errors to AiUnavailableError after retries', async () => {
    let calls = 0;
    const failing = (async () => {
      calls += 1;
      return reply('x', 500)();
    }) as unknown as typeof fetch;
    const { provider, slept } = providerWith(failing);
    await expect(provider.analyze(req, ctx)).rejects.toThrow(AiUnavailableError);
    expect(calls).toBe(3);
    expect(slept).toEqual([625, 1125]);
    const boom = (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    await expect(
      new GeminiProvider({ apiKey: 'K', model: 'm', fetchFn: boom }).analyze(req, ctx),
    ).rejects.toThrow(AiUnavailableError);
  });
  it('does not retry non-retryable client errors', async () => {
    let calls = 0;
    const fetchFn = (async () => {
      calls += 1;
      return reply('x', 400)();
    }) as unknown as typeof fetch;
    const { provider, slept } = providerWith(fetchFn);
    await expect(provider.analyze(req, ctx)).rejects.toThrow(AiUnavailableError);
    expect(calls).toBe(1);
    expect(slept).toEqual([]);
  });
  it('succeeds after retrying transient failures and honours Retry-After', async () => {
    const statuses = [503, 429, 200];
    let calls = 0;
    const fetchFn = (async () => {
      const call = calls;
      calls += 1;
      if (statuses[call] === 429) return reply('x', 429, { 'retry-after': '2' })();
      return reply('{"a":1}', statuses[call] ?? 200)();
    }) as unknown as typeof fetch;
    const { provider, slept } = providerWith(fetchFn);
    expect(await provider.analyze(req, ctx)).toEqual({ a: 1 });
    expect(calls).toBe(3);
    expect(slept).toEqual([625, 2000]);
  });
  it('maps empty text to AiInvalidOutputError', async () => {
    await expect(
      new GeminiProvider({
        apiKey: 'K',
        model: 'm',
        fetchFn: reply('') as unknown as typeof fetch,
      }).analyze(req, ctx),
    ).rejects.toThrow(AiInvalidOutputError);
  });
  it('maps a JSON body whose text holds no JSON to AiInvalidOutputError', async () => {
    const fetchFn = (async () =>
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'pure prose' }] } }] }),
        { status: 200 },
      )) as unknown as typeof fetch;
    await expect(
      new GeminiProvider({ apiKey: 'K', model: 'm', fetchFn }).analyze(req, ctx),
    ).rejects.toThrow(AiInvalidOutputError);
  });
});
