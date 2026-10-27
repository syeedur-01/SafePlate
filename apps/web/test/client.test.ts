import { describe, it, expect, vi, afterEach } from 'vitest';
import { scan, mockScan, ApiClientError } from '../src/api/client';

const req = {
  kind: 'dish' as const,
  imageBase64: 'A'.repeat(200),
  mimeType: 'image/jpeg' as const,
  context: { place: 'home' as const, storage: 'unknown' as const, hoursSinceCooked: null },
};

const okBody = {
  kind: 'dish',
  candidates: [{ dishId: null, label: 'x', confidence: 0.2 }],
  observations: { spoilageSigns: [], imageQuality: 'good', notes: '' },
  provider: 'mock',
  cached: false,
};

describe('scan client', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('posts to /api/scan and parses the result', async () => {
    let url = '';
    const fetchFn = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify(okBody));
    }) as unknown as typeof fetch;
    const r = await scan(req, { baseUrl: 'http://api', fetchFn });
    expect(url).toBe('http://api/api/scan');
    expect(r.kind).toBe('dish');
  });

  it('throws ApiClientError with the server code', async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'slow down' } }), {
        status: 429,
      })) as unknown as typeof fetch;
    await expect(scan(req, { baseUrl: '', fetchFn })).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('maps network failure to ai_unavailable', async () => {
    const fetchFn = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    await expect(scan(req, { baseUrl: '', fetchFn })).rejects.toBeInstanceOf(ApiClientError);
    await expect(scan(req, { baseUrl: '', fetchFn })).rejects.toMatchObject({
      code: 'ai_unavailable',
    });
  });

  it('maps a timeout to ai_unavailable', async () => {
    vi.useFakeTimers();
    const fetchFn = ((_: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;
    const pending = scan(req, { baseUrl: '', fetchFn, timeoutMs: 10 });
    const assertion = expect(pending).rejects.toMatchObject({ code: 'ai_unavailable' });
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });

  it('refuses a request that carries extra fields such as a profile', async () => {
    const bad = { ...req, profile: { conditions: ['diabetes'] } } as unknown as typeof req;
    await expect(
      scan(bad, {
        baseUrl: '',
        fetchFn: (async () => new Response('{}')) as unknown as typeof fetch,
      }),
    ).rejects.toThrow();
  });

  it('returns valid fixtures for dish and label mock scans', () => {
    expect(mockScan('dish').kind).toBe('dish');
    expect(mockScan('label').kind).toBe('label');
  });
});
