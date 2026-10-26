import { describe, it, expect } from 'vitest';
import type { SafetyRule } from '@sp/contracts';
import { scoreSafety, type SafetyInput } from '../src/safety';

const rule = (
  over: Pick<SafetyRule, 'id' | 'trigger' | 'points'> & Partial<SafetyRule>,
): SafetyRule => ({
  labelKey: `safety.${over.id}`,
  mitigationKeys: [],
  sourceRef: null,
  status: 'approved',
  ...over,
});
const base: SafetyInput = {
  dishTags: [],
  observations: { spoilageSigns: [], imageQuality: 'good' },
  context: { place: 'home', storage: 'unknown', hoursSinceCooked: null },
  label: null,
  today: '2026-10-25',
};
const mold = rule({
  id: 'mold',
  points: 40,
  trigger: { type: 'spoilage_sign', sign: 'visible_mold' },
  mitigationKeys: ['m.discard'],
  sourceRef: 'S1',
});

describe('scoreSafety', () => {
  it('scores 0 and low when nothing triggers, and always carries the chemical notice', () => {
    const r = scoreSafety(base, [mold]);
    expect(r).toMatchObject({ score: 0, level: 'low', signals: [] });
    expect(r.notices[0]).toBe('notice.chemical_limit');
  });
  it('adds points with evidence and source for a spoilage sign', () => {
    const r = scoreSafety(
      { ...base, observations: { spoilageSigns: ['visible_mold'], imageQuality: 'good' } },
      [mold],
    );
    expect(r.score).toBe(40);
    expect(r.level).toBe('moderate');
    expect(r.signals[0]).toMatchObject({
      ruleId: 'mold',
      points: 40,
      evidence: 'Photo shows: visible_mold',
      sourceRef: 'S1',
    });
    expect(r.mitigationKeys).toEqual(['m.discard']);
  });
  it('caps the score at 100', () => {
    const big = rule({
      id: 'big',
      points: 90,
      trigger: { type: 'spoilage_sign', sign: 'slimy_surface' },
    });
    const r = scoreSafety(
      {
        ...base,
        observations: { spoilageSigns: ['visible_mold', 'slimy_surface'], imageQuality: 'good' },
      },
      [mold, big],
    );
    expect(r.score).toBe(100);
    expect(r.level).toBe('high');
  });
  it.each([
    [24, 'low'],
    [25, 'moderate'],
    [59, 'moderate'],
    [60, 'high'],
  ] as const)('score %i is %s', (points, level) => {
    const r = scoreSafety(
      { ...base, observations: { spoilageSigns: ['visible_mold'], imageQuality: 'good' } },
      [rule({ id: 'p', points, trigger: { type: 'spoilage_sign', sign: 'visible_mold' } })],
    );
    expect(r.level).toBe(level);
  });
  it('triggers a storage rule at exactly minHours, not before, not for other storage, not for null hours', () => {
    const s = rule({
      id: 's',
      points: 20,
      trigger: { type: 'storage_hours', storage: 'room_temp', minHours: 4 },
    });
    const ctx = (storage: 'room_temp' | 'refrigerated', h: number | null) => ({
      ...base,
      context: { place: 'home' as const, storage, hoursSinceCooked: h },
    });
    expect(scoreSafety(ctx('room_temp', 4), [s]).score).toBe(20);
    expect(scoreSafety(ctx('room_temp', 3.9), [s]).score).toBe(0);
    expect(scoreSafety(ctx('refrigerated', 10), [s]).score).toBe(0);
    expect(scoreSafety(ctx('room_temp', null), [s]).score).toBe(0);
  });
  it('respects the dish tag filter on a storage rule', () => {
    const s = rule({
      id: 's',
      points: 20,
      trigger: { type: 'storage_hours', storage: 'room_temp', minHours: 2, tags: ['dairy'] },
    });
    const c = { place: 'home' as const, storage: 'room_temp' as const, hoursSinceCooked: 5 };
    expect(scoreSafety({ ...base, context: c, dishTags: ['dairy'] }, [s]).score).toBe(20);
    expect(scoreSafety({ ...base, context: c, dishTags: ['fried'] }, [s]).score).toBe(0);
  });
  it('triggers dish tag rules, optionally limited by place', () => {
    const t = rule({
      id: 't',
      points: 10,
      trigger: { type: 'dish_tag', tag: 'street-food', place: 'street' },
    });
    expect(
      scoreSafety(
        { ...base, dishTags: ['street-food'], context: { ...base.context, place: 'street' } },
        [t],
      ).score,
    ).toBe(10);
    expect(scoreSafety({ ...base, dishTags: ['street-food'] }, [t]).score).toBe(0);
  });
  it('flags an expired label using the injected date', () => {
    const e = rule({ id: 'e', points: 50, trigger: { type: 'label_expired' } });
    expect(scoreSafety({ ...base, label: { expiryDate: '2026-10-24' } }, [e]).score).toBe(50);
    expect(scoreSafety({ ...base, label: { expiryDate: '2026-10-25' } }, [e]).score).toBe(0);
    expect(scoreSafety({ ...base, label: { expiryDate: null } }, [e]).score).toBe(0);
    expect(scoreSafety({ ...base, label: null }, [e]).score).toBe(0);
  });
  it('adds a poor-image notice and marks draft status when any rule is draft', () => {
    const r = scoreSafety({ ...base, observations: { spoilageSigns: [], imageQuality: 'poor' } }, [
      rule({ id: 'd', points: 5, status: 'draft', trigger: { type: 'label_expired' } }),
    ]);
    expect(r.notices).toEqual(['notice.chemical_limit', 'notice.poor_image']);
    expect(r.rulesStatus).toBe('draft');
  });
  it('lists each mitigation key once', () => {
    const a = rule({
      id: 'a',
      points: 5,
      trigger: { type: 'spoilage_sign', sign: 'visible_mold' },
      mitigationKeys: ['m.x', 'm.y'],
    });
    const b = rule({
      id: 'b',
      points: 5,
      trigger: { type: 'spoilage_sign', sign: 'visible_mold' },
      mitigationKeys: ['m.y'],
    });
    expect(
      scoreSafety(
        { ...base, observations: { spoilageSigns: ['visible_mold'], imageQuality: 'good' } },
        [a, b],
      ).mitigationKeys,
    ).toEqual(['m.x', 'm.y']);
  });
});
