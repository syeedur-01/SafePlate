import { describe, it, expect } from 'vitest';
import worker from '../src/worker';

describe('worker entry', () => {
  it('serves /api/health from the default export fetch handler', async () => {
    const res = await worker.fetch(new Request('https://worker/api/health'), {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: '0.1.0' });
  });
});
