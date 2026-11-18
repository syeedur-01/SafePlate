import { describe, it, expect } from 'vitest';
import { OllamaProvider } from '../src/ollama-provider';
import { AiUnavailableError, AiInvalidOutputError } from '../src/errors';

const req = {
  kind: 'dish' as const,
  imageBase64: 'QUJD'.repeat(50),
  mimeType: 'image/jpeg' as const,
  context: { place: 'home' as const, storage: 'unknown' as const, hoursSinceCooked: null },
};
const ctx = {
  dishes: [{ id: 'kacchi-biryani', name_en: 'Kacchi Biryani', name_bn: '', aliases: ['Kacchi'] }],
};
const chat = (content: string) => ({ message: { content } });
const jsonReply = (payload: unknown) => JSON.stringify(payload);
const responding =
  (body: unknown, status = 200) =>
  async () =>
    new Response(JSON.stringify(body), { status });

describe('OllamaProvider', () => {
  it('sends the model, JSON format, prompt and image to the local server', async () => {
    let url = '';
    let init: RequestInit = {};
    const fetchFn = (async (u: string, i: RequestInit) => {
      url = u;
      init = i;
      return responding(chat(jsonReply({ a: 1 })))();
    }) as unknown as typeof fetch;
    const out = await new OllamaProvider({ model: 'm-1', baseUrl: 'http://x:1/', fetchFn }).analyze(
      req,
      ctx,
    );
    expect(out).toEqual({ a: 1 });
    expect(url).toBe('http://x:1/api/chat');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('m-1');
    expect(body.stream).toBe(false);
    expect(body.format).toBe('json');
    expect(body.options.temperature).toBe(0.1);
    expect(body.messages[0]!.images).toContain(req.imageBase64);
    expect(body.messages[0]!.content).toContain('Kacchi Biryani');
  });

  it('maps a non-2xx response to AiUnavailableError', async () => {
    const p = new OllamaProvider({
      model: 'm',
      fetchFn: responding({ error: 'x' }, 500) as unknown as typeof fetch,
    });
    await expect(p.analyze(req, ctx)).rejects.toThrow(AiUnavailableError);
  });

  it('maps a network failure to AiUnavailableError', async () => {
    const boom = (async () => {
      throw new Error('connection refused');
    }) as unknown as typeof fetch;
    await expect(
      new OllamaProvider({ model: 'm', fetchFn: boom }).analyze(req, ctx),
    ).rejects.toThrow(AiUnavailableError);
  });

  it('maps an ollama error field to AiUnavailableError without echoing its text', async () => {
    const p = new OllamaProvider({
      model: 'm',
      fetchFn: responding({
        error: 'model weights missing at C:\\secret\\path',
      }) as unknown as typeof fetch,
    });
    await expect(p.analyze(req, ctx)).rejects.toThrow('ollama reported an error');
  });

  it('maps empty text to AiInvalidOutputError', async () => {
    const p = new OllamaProvider({
      model: 'm',
      fetchFn: responding(chat('   ')) as unknown as typeof fetch,
    });
    await expect(p.analyze(req, ctx)).rejects.toThrow(AiInvalidOutputError);
  });

  it('maps prose-only text to AiInvalidOutputError', async () => {
    const p = new OllamaProvider({
      model: 'm',
      fetchFn: responding(chat('I see a delicious meal')) as unknown as typeof fetch,
    });
    await expect(p.analyze(req, ctx)).rejects.toThrow(AiInvalidOutputError);
  });

  it('exposes the model for cache-key scoping', () => {
    expect(new OllamaProvider({ model: 'm-2' }).model).toBe('m-2');
  });
});
