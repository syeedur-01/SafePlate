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
  dishes: [{ id: 'kacchi-biryani', name_en: 'Kacchi Biryani', name_bn: '', aliases: ['Kacchi'] }],
};
const reply =
  (text: string, status = 200) =>
  async () =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status });

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
  it('maps 429 to RateLimitedError', async () => {
    const p = new GeminiProvider({
      apiKey: 'K',
      model: 'm',
      fetchFn: reply('x', 429) as unknown as typeof fetch,
    });
    await expect(p.analyze(req, ctx)).rejects.toThrow(RateLimitedError);
  });
  it('maps 500 and network errors to AiUnavailableError', async () => {
    await expect(
      new GeminiProvider({
        apiKey: 'K',
        model: 'm',
        fetchFn: reply('x', 500) as unknown as typeof fetch,
      }).analyze(req, ctx),
    ).rejects.toThrow(AiUnavailableError);
    const boom = (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    await expect(
      new GeminiProvider({ apiKey: 'K', model: 'm', fetchFn: boom }).analyze(req, ctx),
    ).rejects.toThrow(AiUnavailableError);
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
});
