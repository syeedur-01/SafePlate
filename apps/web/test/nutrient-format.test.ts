import { describe, it, expect } from 'vitest';
import { formatNutrient } from '../src/lib/nutrient-format';

describe('formatNutrient', () => {
  it('rounds energy and sodium to whole numbers', () => {
    expect(formatNutrient('energy_kcal', 434.6)).toBe('435');
    expect(formatNutrient('sodium_mg', 12.4)).toBe('12');
  });

  it('uses one decimal for grams', () => {
    expect(formatNutrient('protein_g', 12.46)).toBe('12.5');
  });
});
