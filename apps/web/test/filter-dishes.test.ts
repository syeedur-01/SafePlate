import { describe, it, expect } from 'vitest';
import { filterDishes } from '../src/lib/filter-dishes';

const opts = [
  { id: 'a', name_en: 'Kacchi Biryani', name_bn: 'কাচ্চি বিরিয়ানি', aliases: ['Kachchi'] },
  { id: 'b', name_en: 'Fuchka', name_bn: 'ফুচকা', aliases: ['Puchka'] },
];

describe('filterDishes', () => {
  it('matches English, case-insensitively and trimmed', () => {
    expect(filterDishes('  KACCHI ', opts, 'en').map((o) => o.id)).toEqual(['a']);
  });
  it('matches Bangla', () => {
    expect(filterDishes('ফুচ', opts, 'bn').map((o) => o.id)).toEqual(['b']);
  });
  it('matches aliases', () => {
    expect(filterDishes('puchka', opts, 'en').map((o) => o.id)).toEqual(['b']);
  });
  it('returns all, sorted, for an empty query', () => {
    expect(filterDishes('', opts, 'en').map((o) => o.id)).toEqual(['b', 'a']);
  });
});
