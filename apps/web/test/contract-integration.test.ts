import { describe, it, expect } from 'vitest';
import { MockProvider } from '@sp/ai';
import { createApp } from '@sp/api/src/app';
import { scan } from '../src/api/client';

const app = createApp({
  allowedOrigin: 'http://localhost:5173',
  maxBodyBytes: 2_000_000,
  provider: new MockProvider(),
  dishes: [],
});
// Route the client's fetch into the API app in-process: no network, same contract.
// The signal is stripped because jsdom's AbortSignal and Node's Request come from
// different realms (undici rejects the cross-realm instance); the client's own
// timeout behaviour is covered elsewhere and needs no signal here.
const fetchFn = ((url: string, init?: RequestInit) => {
  const rest = { ...(init ?? {}) } as RequestInit;
  delete rest.signal;
  return app.request(new URL(url, 'http://local').pathname, rest);
}) as unknown as typeof fetch;
const req = (kind: 'dish' | 'label') => ({
  kind,
  imageBase64: '/9j/4AAQ' + 'Q'.repeat(293),
  mimeType: 'image/jpeg' as const,
  context: { place: 'home' as const, storage: 'unknown' as const, hoursSinceCooked: null },
});

describe('web client against the real api app', () => {
  it('gets a valid dish result', async () => {
    expect((await scan(req('dish'), { baseUrl: 'http://local', fetchFn })).kind).toBe('dish');
  });
  it('gets a valid label result', async () => {
    expect((await scan(req('label'), { baseUrl: 'http://local', fetchFn })).kind).toBe('label');
  });
  it('turns an api error into ApiClientError', async () => {
    const bad = { ...req('dish'), imageBase64: 'short' };
    await expect(scan(bad as never, { baseUrl: 'http://local', fetchFn })).rejects.toThrow();
  });
});
