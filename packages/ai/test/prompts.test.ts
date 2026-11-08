import { describe, it, expect } from 'vitest';
import { SPOILAGE_SIGNS } from '@sp/contracts';
import { buildDishPrompt, buildLabelPrompt } from '../src/prompts';
const ctx = {
  dishes: [
    { id: 'kacchi-biryani', name_en: 'Kacchi Biryani', name_bn: '', aliases: ['Kacchi'] },
    { id: 'fuchka', name_en: 'Fuchka', name_bn: '', aliases: [] },
  ],
};
const c = { place: 'home' as const, storage: 'unknown' as const, hoursSinceCooked: null };
describe('prompts', () => {
  it('lists every dish id and every spoilage sign', () => {
    const p = buildDishPrompt(ctx, c);
    for (const id of ['kacchi-biryani', 'fuchka']) expect(p).toContain(id);
    for (const s of SPOILAGE_SIGNS) expect(p).toContain(s);
    expect(p.toLowerCase()).toContain('json');
  });
  it('never mentions health conditions and stays short', () => {
    const p = buildDishPrompt(ctx, c) + buildLabelPrompt();
    expect(p.toLowerCase()).not.toContain('diabet');
    expect(p.length).toBeLessThan(9000);
  });
  it('label prompt demands null for unreadable fields', () => {
    expect(buildLabelPrompt().toLowerCase()).toContain('null');
  });
});
