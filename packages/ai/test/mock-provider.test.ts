import { describe, it, expect } from 'vitest';
import { ScanResultSchema } from '@sp/contracts';
import { MockProvider } from '../src/mock-provider';
const ctx = { dishes: [] };
const mk = (kind: 'dish' | 'label', img = 'B'.repeat(200)) => ({
  kind,
  imageBase64: img,
  mimeType: 'image/jpeg' as const,
  context: { place: 'home' as const, storage: 'unknown' as const, hoursSinceCooked: null },
});
describe('MockProvider', () => {
  it('returns valid results for both kinds', async () => {
    const m = new MockProvider();
    expect(ScanResultSchema.parse(await m.analyze(mk('dish'), ctx)).kind).toBe('dish');
    expect(ScanResultSchema.parse(await m.analyze(mk('label'), ctx)).kind).toBe('label');
  });
  it('is deterministic for the same input', async () => {
    const m = new MockProvider();
    expect(await m.analyze(mk('dish'), ctx)).toEqual(await m.analyze(mk('dish'), ctx));
  });
  it('can force a fixture', async () => {
    const r = ScanResultSchema.parse(
      await new MockProvider({ forceFixture: 'dish-mishti-doi-spoiled' }).analyze(mk('dish'), ctx),
    );
    expect(r.kind === 'dish' && r.observations.spoilageSigns).toContain('foam_or_bubbles');
  });
});
