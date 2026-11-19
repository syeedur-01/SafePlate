import { describe, it, expect } from 'vitest';
import { makeDish, makeIngredient } from '@sp/contracts/testing';
import { verifyAll, type VerifyInput } from '../src/verify-lib';
const ok = (): VerifyInput => ({
  dishes: [
    makeDish({
      id: 'd',
      ingredients: [{ ingredient_id: 'x', grams_raw: 10, quantity_basis: 'ESTIMATE' }],
      review_provenance: 'ai_assisted_review',
    }) as never,
  ],
  ingredients: [
    makeIngredient({
      id: 'x',
      energy_kcal: 100,
      review_provenance: 'source_verified',
      nutrient_sources: { energy_kcal: { source_id: 'FCTB-2013', food_code: '01_0025' } },
    }),
  ],
  safetyRules: [],
  healthRules: [],
  messages: {},
  sourceIds: new Set(['bd-fctb-2013']),
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
  it('reports a nutrient value without a per-value source entry', () => {
    const i = ok();
    i.ingredients = [
      makeIngredient({ id: 'x', energy_kcal: 100, review_provenance: 'source_verified' }),
    ];
    const text = verifyAll(i).join('\n');
    expect(text).toContain('x');
    expect(text).toContain('energy_kcal');
  });
  it('reports an unresolvable provenance source_id', () => {
    const i = ok();
    i.ingredients = [
      makeIngredient({
        id: 'x',
        energy_kcal: 100,
        review_provenance: 'source_verified',
        nutrient_sources: { energy_kcal: { source_id: 'UNKNOWN-DB' } },
      }),
    ];
    const text = verifyAll(i).join('\n');
    expect(text).toContain('UNKNOWN-DB');
    expect(text).toContain('source register');
  });
  it('passes a provenance source_id that is a register id directly', () => {
    const i = ok();
    i.sourceIds = new Set(['bd-fctb-2013', 'usda-fdc']);
    i.ingredients = [
      makeIngredient({
        id: 'x',
        energy_kcal: 100,
        review_provenance: 'source_verified',
        nutrient_sources: { energy_kcal: { source_id: 'usda-fdc', fdc_id: 123456 } },
      }),
    ];
    expect(verifyAll(i)).toEqual([]);
  });
  it('reports an ingredient missing review_provenance', () => {
    const i = ok();
    i.ingredients = [makeIngredient({ id: 'x', energy_kcal: 100 })];
    const text = verifyAll(i).join('\n');
    expect(text).toContain('missing review_provenance');
    expect(text).toContain('ingredient x');
  });
  it('reports a dish missing review_provenance', () => {
    const i = ok();
    i.dishes = [makeDish({ id: 'd2' }) as never];
    const text = verifyAll(i).join('\n');
    expect(text).toContain('missing review_provenance');
    expect(text).toContain('dish d2');
  });
  it('reports a storage_hours safety rule as disabled', () => {
    const i = ok();
    i.sourceIds = new Set(['s']);
    i.messages = { 'safety.r': { en: 'x', bn: 'y' } };
    i.safetyRules = [
      {
        id: 'r',
        trigger: { type: 'storage_hours', storage: 'room_temp', minHours: 4 },
        points: 5,
        labelKey: 'safety.r',
        mitigationKeys: [],
        sourceRef: 's',
        status: 'draft',
      },
    ];
    const text = verifyAll(i).join('\n');
    expect(text).toContain('storage_hours triggers are disabled');
    expect(text).toContain('r');
  });
});
