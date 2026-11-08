import { describe, it, expect } from 'vitest';
import { ApiErrorSchema } from '@sp/contracts';
import { createApp } from '../src/app';

const app = createApp({ allowedOrigin: 'http://localhost:5173', maxBodyBytes: 1000 });

describe('api skeleton', () => {
  it('answers /api/health', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: expect.any(String) });
  });
  it('returns the standard error shape for unknown routes', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.safeParse(await res.json()).success).toBe(true);
  });
  it('allows only the configured origin', async () => {
    const ok = await app.request('/api/health', { headers: { Origin: 'http://localhost:5173' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const bad = await app.request('/api/health', { headers: { Origin: 'https://evil.example' } });
    expect(bad.headers.get('access-control-allow-origin')).not.toBe('https://evil.example');
  });
  it('rejects a body above the limit with 413 and code too_large', async () => {
    const res = await app.request('/api/anything', {
      method: 'POST',
      headers: { 'content-length': '5000' },
      body: 'x'.repeat(10),
    });
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe('too_large');
  });
});
