import { describe, it, expect } from 'vitest';
import {
  ScanRequestSchema,
  ScanResultSchema,
  UserProfileSchema,
  SafetyResultSchema,
  NutrientRuleSchema,
  SPOILAGE_SIGNS,
  DishSchema,
  SourceEntrySchema,
  MessagesFileSchema,
} from '../src';
import { makeDish, makeIngredient, makeProfile } from '../src/testing';
import { RawDishSchema, IngredientSchema } from '../src/knowledge';

const img = 'A'.repeat(200);
const ctx = { place: 'home', storage: 'unknown', hoursSinceCooked: null } as const;

describe('ScanRequest', () => {
  it('accepts a valid request', () => {
    expect(
      ScanRequestSchema.safeParse({
        kind: 'dish',
        imageBase64: img,
        mimeType: 'image/jpeg',
        context: ctx,
      }).success,
    ).toBe(true);
  });
  it('rejects any extra field, so a health profile can never be sent', () => {
    const r = ScanRequestSchema.safeParse({
      kind: 'dish',
      imageBase64: img,
      mimeType: 'image/jpeg',
      context: ctx,
      profile: { conditions: ['diabetes'] },
    });
    expect(r.success).toBe(false);
  });
  it('rejects an oversized image', () => {
    expect(
      ScanRequestSchema.safeParse({
        kind: 'dish',
        imageBase64: 'A'.repeat(1_800_001),
        mimeType: 'image/jpeg',
        context: ctx,
      }).success,
    ).toBe(false);
  });
  it('rejects an unsupported mime type', () => {
    expect(
      ScanRequestSchema.safeParse({
        kind: 'dish',
        imageBase64: img,
        mimeType: 'image/gif',
        context: ctx,
      }).success,
    ).toBe(false);
  });
});

describe('ScanResult', () => {
  it('discriminates on kind', () => {
    const dish = {
      kind: 'dish',
      candidates: [{ dishId: 'kacchi-biryani', label: 'Kacchi Biryani', confidence: 0.8 }],
      observations: { spoilageSigns: [], imageQuality: 'good', notes: '' },
      provider: 'mock',
      cached: false,
    };
    expect(ScanResultSchema.parse(dish).kind).toBe('dish');
  });
  it('rejects an unknown spoilage sign', () => {
    const bad = {
      kind: 'dish',
      candidates: [{ dishId: null, label: 'x', confidence: 0.1 }],
      observations: { spoilageSigns: ['smells_bad'], imageQuality: 'good', notes: '' },
      provider: 'mock',
      cached: false,
    };
    expect(ScanResultSchema.safeParse(bad).success).toBe(false);
  });
  it('lists 8 spoilage signs', () => {
    expect(SPOILAGE_SIGNS).toHaveLength(8);
  });
});

describe('profile and rules', () => {
  it('rejects unknown profile fields', () => {
    expect(UserProfileSchema.safeParse({ ...makeProfile(), name: 'x' }).success).toBe(false);
  });
  it('requires at least one notice on a safety result', () => {
    const base = {
      score: 0,
      level: 'low',
      signals: [],
      mitigationKeys: [],
      notices: [],
      rulesStatus: 'draft',
    };
    expect(SafetyResultSchema.safeParse(base).success).toBe(false);
  });
  it('requires avoidFraction >= cautionFraction', () => {
    const r = {
      kind: 'nutrient',
      id: 'r1',
      condition: 'hypertension',
      nutrient: 'sodium_mg',
      dailyLimit: 1000,
      cautionFraction: 0.5,
      avoidFraction: 0.2,
      messageKey: 'warn.sodium_high',
      sourceRef: 's1',
      status: 'draft',
    };
    expect(NutrientRuleSchema.safeParse(r).success).toBe(false);
  });
});

describe('normalized dish, sources, messages', () => {
  const raw = makeDish({ id: 'd1' });
  it('DishSchema needs a cooking class and canonical allergens', () => {
    expect(DishSchema.safeParse({ ...raw, cooking_class: 'steamed' }).success).toBe(true);
    expect(DishSchema.safeParse(raw).success).toBe(false);
    expect(
      DishSchema.safeParse({ ...raw, cooking_class: 'steamed', allergens: ['dairy'] }).success,
    ).toBe(false);
    expect(
      DishSchema.safeParse({ ...raw, cooking_class: 'steamed', allergens: ['milk'] }).success,
    ).toBe(true);
  });
  it('SourceEntrySchema requires a url and a known tier and status', () => {
    const ok = {
      id: 's1',
      title: 'T',
      publisher: 'P',
      year: 2025,
      edition: null,
      url: 'https://example.org/a',
      tier: 'bangladesh',
      status: 'unverified',
      accessedOn: null,
    };
    expect(SourceEntrySchema.safeParse(ok).success).toBe(true);
    expect(SourceEntrySchema.safeParse({ ...ok, url: 'not a url' }).success).toBe(false);
    expect(SourceEntrySchema.safeParse({ ...ok, status: 'maybe' }).success).toBe(false);
  });
  it('MessagesFileSchema needs both languages', () => {
    expect(MessagesFileSchema.safeParse({ 'a.b': { en: 'x', bn: 'y' } }).success).toBe(true);
    expect(MessagesFileSchema.safeParse({ 'a.b': { en: 'x' } }).success).toBe(false);
  });
});

describe('builders', () => {
  it('build valid objects', () => {
    expect(RawDishSchema.safeParse(makeDish({ id: 'd1' })).success).toBe(true);
    expect(IngredientSchema.safeParse(makeIngredient({ id: 'x' })).success).toBe(true);
  });
});
