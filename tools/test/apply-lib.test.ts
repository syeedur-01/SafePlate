import { describe, it, expect } from 'vitest';
import { makeIngredient } from '@sp/contracts/testing';
import { applyApprovals } from '../src/apply-lib';

const hilsa = makeIngredient({ id: 'hilsa' });
const turmeric = makeIngredient({ id: 'turmeric', energy_kcal: 354 });

describe('applyApprovals', () => {
  it('fills null fields from FCTB with provenance', () => {
    const r = applyApprovals(
      [hilsa],
      [
        {
          ingredientId: 'hilsa',
          foodCode: '08_0001',
          table: 'Proximate composition',
          page: 40,
          values: { energy_kcal: 200, protein_g: 20 },
        },
      ],
      [],
    );
    expect(r.ingredients[0]).toMatchObject({
      energy_kcal: 200,
      protein_g: 20,
      review_status: 'approved',
    });
    expect(r.ingredients[0]?.nutrient_sources.energy_kcal).toMatchObject({
      source_id: 'FCTB-2013',
      food_code: '08_0001',
      pdf_page: 40,
    });
    expect(r.applied).toEqual(['hilsa']);
  });

  it('never overwrites a non-null value', () => {
    const r = applyApprovals(
      [turmeric],
      [],
      [
        {
          ingredientId: 'turmeric',
          fdcId: 7,
          description: 'Turmeric',
          patch: { energy_kcal: 1, sodium_mg: 38 },
        },
      ],
    );
    expect(r.ingredients[0]?.energy_kcal).toBe(354);
    expect(r.ingredients[0]?.sodium_mg).toBe(38);
    expect(r.ingredients[0]?.match_quality).toBe('proxy');
  });

  it('is idempotent and does not mutate its input', () => {
    const input = [hilsa];
    const approvals = [
      { ingredientId: 'hilsa', foodCode: 'x', table: 't', page: 1, values: { energy_kcal: 200 } },
    ];
    const once = applyApprovals(input, approvals, []);
    expect(applyApprovals(once.ingredients, approvals, []).ingredients).toEqual(once.ingredients);
    expect(input[0]?.energy_kcal).toBeNull();
  });

  it('ignores approvals for unknown ingredients', () => {
    expect(
      applyApprovals(
        [hilsa],
        [{ ingredientId: 'nope', foodCode: 'x', table: 't', page: 1, values: { energy_kcal: 1 } }],
        [],
      ).applied,
    ).toEqual([]);
  });

  it('fills null fields from a gap IFCT row with IFCT provenance and direct quality', () => {
    const r = applyApprovals(
      [makeIngredient({ id: 'moong-dal-raw' })],
      [],
      [],
      [
        {
          ingredientId: 'moong-dal-raw',
          matchQuality: 'exact',
          rows: [
            {
              source: 'ifct-2017',
              foodCode: 'B010',
              fdcId: null,
              rowName: 'Green gram, dal (Vigna radiata)',
              table: 'Table 1. Proximate Principles and Dietary Fibre',
              page: 42,
              values: { energy_kcal: 325.7, protein_g: 23.88 },
            },
          ],
        },
      ],
    );
    expect(r.ingredients[0]).toMatchObject({
      energy_kcal: 325.7,
      protein_g: 23.88,
      review_status: 'approved',
      match_quality: 'direct',
    });
    expect(r.ingredients[0]?.nutrient_sources.energy_kcal).toMatchObject({
      source_id: 'IFCT-2017',
      food_code: 'B010',
      pdf_page: 42,
    });
  });

  it('flags a gap USDA row as proxy even when the match looked exact', () => {
    const r = applyApprovals(
      [makeIngredient({ id: 'rice-flour-unverified' })],
      [],
      [],
      [
        {
          ingredientId: 'rice-flour-unverified',
          matchQuality: 'exact',
          rows: [
            {
              source: 'usda-fdc',
              foodCode: null,
              fdcId: 169714,
              rowName: 'Rice flour, white, unenriched (SR Legacy)',
              table: 'SR Legacy nutrient record',
              page: null,
              values: { energy_kcal: 366 },
            },
          ],
        },
      ],
    );
    expect(r.ingredients[0]?.energy_kcal).toBe(366);
    expect(r.ingredients[0]?.match_quality).toBe('proxy');
    expect(r.ingredients[0]?.nutrient_sources.energy_kcal).toMatchObject({
      source_id: 'USDA-FDC',
      fdc_id: 169714,
    });
  });

  it('applies FCTB, USDA and gap approvals to one ingredient without collision', () => {
    const ing = makeIngredient({ id: 'egg-chicken-farmed-raw' });
    const r = applyApprovals(
      [ing],
      [
        {
          ingredientId: 'egg-chicken-farmed-raw',
          foodCode: '11_0001',
          table: 'Proximate composition',
          page: 132,
          values: { energy_kcal: 143, protein_g: 12.6 },
        },
      ],
      [],
      [
        {
          ingredientId: 'egg-chicken-farmed-raw',
          matchQuality: 'proxy',
          rows: [
            {
              source: 'usda-fdc',
              foodCode: null,
              fdcId: 171287,
              rowName: 'Egg, whole, raw, fresh (SR Legacy)',
              table: 'SR Legacy nutrient record',
              page: null,
              values: { sat_fat_g: 3.126, sodium_mg: 142 },
            },
          ],
        },
      ],
    );
    expect(r.ingredients[0]).toMatchObject({
      energy_kcal: 143,
      protein_g: 12.6,
      sat_fat_g: 3.126,
      sodium_mg: 142,
      review_status: 'approved',
      match_quality: 'proxy',
    });
    expect(r.ingredients[0]?.nutrient_sources.energy_kcal).toMatchObject({
      source_id: 'FCTB-2013',
    });
    expect(r.ingredients[0]?.nutrient_sources.sat_fat_g).toMatchObject({ source_id: 'USDA-FDC' });
    expect(r.applied).toEqual(['egg-chicken-farmed-raw']);
  });

  it('reports no change for an approved gap entry whose rows were already filled', () => {
    const filled = makeIngredient({
      id: 'white-sugar',
      energy_kcal: 398,
      sat_fat_g: 0,
      sugars_g: 99.8,
      sodium_mg: 1,
    });
    const r = applyApprovals(
      [filled],
      [],
      [],
      [
        {
          ingredientId: 'white-sugar',
          matchQuality: 'exact',
          rows: [
            {
              source: 'usda-fdc',
              foodCode: null,
              fdcId: 169655,
              rowName: 'Sugars, granulated (SR Legacy)',
              table: 'SR Legacy nutrient record',
              page: null,
              values: { sat_fat_g: 0, sugars_g: 99.8, sodium_mg: 1 },
            },
          ],
        },
      ],
    );
    expect(r.applied).toEqual([]);
    expect(r.ingredients[0]?.review_status).toBeUndefined();
  });

  it('fills a value of zero from an approval (zero is a value, not missing)', () => {
    const r = applyApprovals(
      [makeIngredient({ id: 'chicken-leg-skinless-raw' })],
      [],
      [
        {
          ingredientId: 'chicken-leg-skinless-raw',
          fdcId: 173619,
          description: 'Chicken, broilers or fryers, leg, meat only, raw',
          patch: { sat_fat_g: 1.05, sugars_g: 0 },
        },
      ],
    );
    expect(r.ingredients[0]?.sugars_g).toBe(0);
    expect(r.ingredients[0]?.nutrient_sources.sugars_g).toMatchObject({ fdc_id: 173619 });
  });
});
