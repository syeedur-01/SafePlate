import { describe, it, expect } from 'vitest';
import { ApiErrorSchema } from '@sp/contracts';
import { MockProvider, type VisionProvider } from '@sp/ai';
import { createApp } from '../src/app';

const IMG = 'Z'.repeat(300);
const labelBody = JSON.stringify({
  kind: 'label',
  imageBase64: IMG,
  mimeType: 'image/jpeg',
  context: { place: 'packaged', storage: 'unknown', hoursSinceCooked: null },
});
const post = (app: ReturnType<typeof createApp>, b: string) =>
  app.request('/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: b,
  });
const cfg = (provider: VisionProvider) => ({
  allowedOrigin: 'http://x',
  maxBodyBytes: 2_000_000,
  provider,
  dishes: [],
});
const dishForLabel: VisionProvider = {
  name: 't',
  analyze: async () => ({
    kind: 'dish',
    candidates: [{ dishId: null, label: 'x', confidence: 0.1 }],
    observations: { spoilageSigns: [], imageQuality: 'good', notes: '' },
  }),
};

describe('POST /api/scan label path', () => {
  it('returns a label result for a label request through the mock provider', async () => {
    const res = await post(createApp(cfg(new MockProvider())), labelBody);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { kind: string };
    expect(json.kind).toBe('label');
  });
  it('answers 502 ai_invalid_output when a label request gets a dish result', async () => {
    const res = await post(createApp(cfg(dishForLabel)), labelBody);
    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: { code: string } };
    expect(ApiErrorSchema.safeParse(json).success).toBe(true);
    expect(json.error.code).toBe('ai_invalid_output');
  });
});
