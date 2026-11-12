import { describe, it, expect } from 'vitest';
import { MessagesFileSchema, SafetyRulesFileSchema, HealthRulesFileSchema } from '@sp/contracts';
import { getMessages, getAllergenKeywords } from '../src';
import safety from '../data/proposals/safety-rules-proposals.json';
import health from '../data/proposals/health-rules-proposals.json';

const m = getMessages();
const ph = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)]
    .map((x) => x[1])
    .sort()
    .join(',');
describe('messages', () => {
  it('validates and has both languages everywhere', () => {
    expect(MessagesFileSchema.safeParse(m).success).toBe(true);
  });
  it('has every key referenced by the rule proposals', () => {
    const rules = SafetyRulesFileSchema.parse({ rules: safety.rules }).rules;
    const hr = HealthRulesFileSchema.parse({ rules: health.rules }).rules;
    const keys = [
      ...rules.flatMap((r) => [r.labelKey, ...r.mitigationKeys]),
      ...hr.map((r) => r.messageKey),
      'warn.allergen_present',
      'warn.insufficient_data',
      'notice.chemical_limit',
      'notice.poor_image',
    ];
    expect(keys.filter((k) => !m[k])).toEqual([]);
  });
  it('keeps placeholders identical in en and bn', () => {
    for (const [k, v] of Object.entries(m)) expect(ph(v.bn), k).toBe(ph(v.en));
  });
  it('avoids forbidden claims in English', () => {
    for (const [k, v] of Object.entries(m))
      expect(v.en, k).not.toMatch(/will cause|\bcure\b|\btreat\b|diagnos/i);
  });
  it('carries the exact chemical-limit notice', () => {
    expect(m['notice.chemical_limit']?.en).toContain(
      'cannot detect invisible chemical contamination',
    );
  });
  it('has bangla text that differs from english', () => {
    for (const [k, v] of Object.entries(m))
      if (!/^[\W\d_]*$/.test(v.en)) expect(v.bn, k).not.toBe(v.en);
  });
});
describe('allergen keywords', () => {
  it('covers all ten allergens with at least one English and one Bangla keyword', () => {
    const k = getAllergenKeywords();
    expect(Object.keys(k)).toHaveLength(10);
    for (const [a, words] of Object.entries(k)) {
      expect(
        words.some((w) => /^[a-z ]+$/.test(w)),
        a,
      ).toBe(true);
      expect(
        words.some((w) => /[\u0980-\u09FF]/.test(w)),
        a,
      ).toBe(true);
    }
  });
});
