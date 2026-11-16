import { describe, it, expect } from 'vitest';
import { makeDish, makeIngredient } from '@sp/contracts/testing';
import { verifyAll, type VerifyInput } from '../src/verify-lib';
const ok = (): VerifyInput => ({
  dishes: [
    makeDish({
      id: 'd',
      ingredients: [{ ingredient_id: 'x', grams_raw: 10, quantity_basis: 'ESTIMATE' }],
    }) as never,
  ],
  ingredients: [makeIngredient({ id: 'x', energy_kcal: 100 })],
  safetyRules: [],
  healthRules: [],
  messages: {},
  sourceIds: new Set(),
});
describe('verifyAll', () => {
  it('passes consistent data', () => {
    expect(verifyAll(ok())).toEqual([]);
  });
  it('reports a dangling ingredient', () => {
    const i = ok();
    i.ingredients = [];
    expect(verifyAll(i).join('\n')).toContain('x');
  });
  it('reports a rule with an unknown source', () => {
    const i = ok();
    i.safetyRules = [
      {
        id: 'r',
        trigger: { type: 'label_expired' },
        points: 5,
        labelKey: 'safety.r',
        mitigationKeys: [],
        sourceRef: 'nope',
        status: 'draft',
      },
    ];
    expect(verifyAll(i).join('\n')).toContain('nope');
  });
  it('reports a missing message key', () => {
    const i = ok();
    i.sourceIds = new Set(['s']);
    i.safetyRules = [
      {
        id: 'r',
        trigger: { type: 'label_expired' },
        points: 5,
        labelKey: 'safety.r',
        mitigationKeys: ['mitigation.m'],
        sourceRef: 's',
        status: 'draft',
      },
    ];
    const text = verifyAll(i).join('\n');
    expect(text).toContain('safety.r');
    expect(text).toContain('mitigation.m');
  });
  it('reports a negative nutrient value', () => {
    const i = ok();
    i.ingredients = [makeIngredient({ id: 'x', energy_kcal: -1 })];
    expect(verifyAll(i).length).toBeGreaterThan(0);
  });
  it('reports duplicate dish ids', () => {
    const i = ok();
    i.dishes = [i.dishes[0]!, i.dishes[0]!];
    expect(verifyAll(i).join('\n')).toContain('d');
  });
});
