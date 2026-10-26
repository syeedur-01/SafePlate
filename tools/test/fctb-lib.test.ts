import { describe, it, expect } from 'vitest';
import { makeIngredient } from '@sp/contracts/testing';
import { tokens, scoreMatch, candidatesFor, calibrate, type FctbRow } from '../src/fctb-lib';

const row = (foodCode: string, name: string, values: FctbRow['values'] = {}): FctbRow => ({
  foodCode,
  name,
  page: 33,
  table: 'Proximate composition',
  values,
  rowText: `${foodCode} ${name}`,
});

describe('fctb-lib', () => {
  it('tokenizes without stop words', () => {
    expect(tokens('Rice, white, RAW')).toEqual(['rice', 'white']);
  });
  it('scores identical names 1 and unrelated names 0', () => {
    expect(scoreMatch('hilsa', 'Hilsa')).toBe(1);
    expect(scoreMatch('hilsa', 'Wheat flour')).toBe(0);
  });
  it('returns the best candidates first and respects limit and minScore', () => {
    const rows = [row('1', 'Hilsa fish'), row('2', 'Hilsa'), row('3', 'Wheat')];
    const c = candidatesFor('hilsa', rows, 5, 0.3);
    expect(c.map((x) => x.foodCode)).toEqual(['2', '1']);
    expect(candidatesFor('hilsa', rows, 1, 0.3)).toHaveLength(1);
  });
  it('calibrate returns ids whose stored values differ from the parsed row', () => {
    const known = [
      makeIngredient({
        id: 'rice',
        energy_kcal: 345,
        nutrient_sources: { energy_kcal: { source_id: 'FCTB-2013', food_code: '01_0025' } },
      }),
    ];
    expect(calibrate([row('01_0025', 'Rice', { energy_kcal: 345 })], known)).toEqual([]);
    expect(calibrate([row('01_0025', 'Rice', { energy_kcal: 999 })], known)).toEqual(['rice']);
  });
});
