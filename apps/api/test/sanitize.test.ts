import { describe, it, expect } from 'vitest';
import { sanitizeLabelResult } from '../src/sanitize';

const base = {
  kind: 'label' as const,
  productName: null,
  ingredientsText: 'x',
  declaredAllergens: [],
  expiryDate: '2026-12-01',
  nutritionPer100g: null,
  observations: { spoilageSigns: [], imageQuality: 'good' as const, notes: '' },
  provider: 'm',
  cached: false,
};

describe('sanitizeLabelResult', () => {
  it('keeps a plausible date', () => {
    expect(sanitizeLabelResult(base).expiryDate).toBe('2026-12-01');
  });
  it.each(['1999-01-01', '2101-01-01', '2026-02-31', '2026-13-01'])('drops %s', (d) => {
    expect(sanitizeLabelResult({ ...base, expiryDate: d }).expiryDate).toBeNull();
  });
  it('trims very long text', () => {
    expect(
      sanitizeLabelResult({ ...base, ingredientsText: 'a'.repeat(5000) }).ingredientsText,
    ).toHaveLength(2000);
  });
});
