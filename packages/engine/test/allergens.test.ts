import { describe, it, expect } from 'vitest';
import { allergenConflicts, allergenWarnings } from '../src/allergens';

describe('allergenConflicts', () => {
  it('returns the overlap in the user order', () => {
    expect(allergenConflicts(['fish', 'milk', 'egg'], ['egg', 'milk'])).toEqual(['milk', 'egg']);
  });
  it('returns nothing when there is no overlap or no allergies', () => {
    expect(allergenConflicts(['fish'], ['milk'])).toEqual([]);
    expect(allergenConflicts([], ['milk'])).toEqual([]);
  });
  it('removes duplicates', () => {
    expect(allergenConflicts(['milk', 'milk'], ['milk', 'milk'])).toEqual(['milk']);
  });
});
describe('allergenWarnings', () => {
  it('builds avoid warnings', () => {
    const w = allergenWarnings(['milk'], ['milk', 'egg']);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({
      id: 'allergen:milk',
      kind: 'allergen',
      level: 'avoid',
      allergen: 'milk',
      messageKey: 'warn.allergen_present',
      condition: null,
      sourceRef: null,
    });
    expect(w[0]?.params).toEqual({ allergen: 'milk' });
  });
});
