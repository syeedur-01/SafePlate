import { describe, it, expect } from 'vitest';
import { mergeRules, demoDishIds } from '../src/merge-lib';
describe('mergeRules', () => {
  const ok = { id: 'r1', sourceRef: 's1', status: 'draft' };
  it('keeps statuses and order', () => {
    expect(
      mergeRules([ok, { id: 'r2', sourceRef: 's1', status: 'approved' }], new Set(['s1'])).map(
        (r) => r.status,
      ),
    ).toEqual(['draft', 'approved']);
  });
  it('throws for an unknown or missing source', () => {
    expect(() => mergeRules([{ id: 'r', sourceRef: 'nope' }], new Set(['s1']))).toThrow('r');
    expect(() => mergeRules([{ id: 'r', sourceRef: null }], new Set(['s1']))).toThrow('r');
  });
  it('throws for duplicate ids', () => {
    expect(() => mergeRules([ok, ok], new Set(['s1']))).toThrow('r1');
  });
});
describe('demoDishIds', () => {
  it('keeps dishes at or above the gate, sorted', () => {
    expect(
      demoDishIds([
        { dishId: 'b', energyCoverage: 0.8 },
        { dishId: 'a', energyCoverage: 0.95 },
        { dishId: 'c', energyCoverage: 0.79 },
      ]),
    ).toEqual(['a', 'b']);
  });
});
