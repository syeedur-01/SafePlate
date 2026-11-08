import { describe, it, expect } from 'vitest';
import type { ScanRequest } from '@sp/contracts';
import { runScan } from '../src/run-scan';
import { AiInvalidOutputError } from '../src/errors';
import type { VisionProvider } from '../src/provider';

const req: ScanRequest = {
  kind: 'dish',
  imageBase64: 'A'.repeat(200),
  mimeType: 'image/jpeg',
  context: { place: 'home', storage: 'unknown', hoursSinceCooked: null },
};
const ctx = {
  dishes: [{ id: 'kacchi-biryani', name_en: 'Kacchi Biryani', name_bn: '', aliases: [] }],
};
const good = (id: string | null) => ({
  kind: 'dish',
  candidates: [{ dishId: id, label: 'x', confidence: 0.5 }],
  observations: { spoilageSigns: [], imageQuality: 'good', notes: '' },
  provider: 'ignored',
  cached: true,
});
const fake = (outputs: unknown[]) => {
  const state = { calls: 0 };
  const p: VisionProvider = {
    name: 'fake',
    analyze: async () => outputs[Math.min(state.calls++, outputs.length - 1)],
  };
  return { p, state };
};

describe('runScan', () => {
  it('validates and stamps provider and cached', async () => {
    const r = await runScan(fake([good('kacchi-biryani')]).p, req, ctx);
    expect(r.provider).toBe('fake');
    expect(r.cached).toBe(false);
  });
  it('accepts text output with fences', async () => {
    const r = await runScan(
      fake(['```json\n' + JSON.stringify(good('kacchi-biryani')) + '\n```']).p,
      req,
      ctx,
    );
    expect(r.kind).toBe('dish');
  });
  it('retries once on invalid output', async () => {
    const f = fake([{ nope: true }, good('kacchi-biryani')]);
    await runScan(f.p, req, ctx);
    expect(f.state.calls).toBe(2);
  });
  it('throws AiInvalidOutputError after two invalid outputs', async () => {
    await expect(runScan(fake([{ nope: true }]).p, req, ctx)).rejects.toThrow(AiInvalidOutputError);
  });
  it('replaces unknown dish ids with null', async () => {
    const r = await runScan(fake([good('made-up-dish')]).p, req, ctx);
    if (r.kind === 'dish') expect(r.candidates[0]?.dishId).toBeNull();
  });
  it('does not retry when the provider itself throws', async () => {
    const state = { calls: 0 };
    const p: VisionProvider = {
      name: 'x',
      analyze: async () => {
        state.calls++;
        throw new Error('boom');
      },
    };
    await expect(runScan(p, req, ctx)).rejects.toThrow('boom');
    expect(state.calls).toBe(1);
  });
});
