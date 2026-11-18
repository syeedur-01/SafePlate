import { describe, it, expect } from 'vitest';
import { SPOILAGE_SIGNS } from '@sp/contracts';
import { buildDishPrompt, buildLabelPrompt } from '../src/prompts';
const ctx = {
  catalogue: [
    {
      id: 'kacchi-biryani',
      name_en: 'Kacchi Biryani',
      name_bn: 'কাচ্চি বিরিয়ানি',
      aliases: ['Kacchi'],
      category: 'Rice & festive specialties',
    },
    {
      id: 'singara',
      name_en: 'Singara',
      name_bn: null,
      aliases: [],
      category: 'Snacks',
    },
  ],
};
const c = { place: 'home' as const, storage: 'unknown' as const, hoursSinceCooked: null };
describe('prompts', () => {
  it('lists every catalogue id, its category and every spoilage sign', () => {
    const p = buildDishPrompt(ctx, c);
    for (const id of ['kacchi-biryani', 'singara']) expect(p).toContain(id);
    expect(p).toContain('Rice & festive specialties');
    expect(p).toContain('Snacks');
    expect(p).toContain('কাচ্চি বিরিয়ানি');
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
