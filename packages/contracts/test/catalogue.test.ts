// catalogue.test.ts: the recognition catalogue schema accepts valid entries and
// rejects the shapes that would let an unapproved item slip into nutrition paths.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { CatalogueFileSchema } from '../src/knowledge';

const load = (name: string): unknown =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../knowledge/data/${name}`, import.meta.url)), 'utf8'),
  );

describe('catalogue schema', () => {
  it('accepts the committed catalogue file', () => {
    const file = CatalogueFileSchema.safeParse(load('catalogue/catalogue.json'));
    expect(file.success).toBe(true);
  });

  it('accepts a minimal catalogue-only entry with null nutrition link and null Bangla name', () => {
    const parsed = CatalogueFileSchema.safeParse({
      version: 1,
      entries: [
        {
          id: 'singara',
          name_en: 'Singara',
          name_bn: null,
          aliases: [],
          category: 'Snacks',
          nutrition_dish_id: null,
          provenance: { source: 'BD-Food33 v1 dataset label (CC0-1.0)', added: '2026-11-18' },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a non-slug id and a non-slug nutrition link', () => {
    const base = {
      name_en: 'Singara',
      name_bn: null,
      aliases: [],
      category: 'Snacks',
      provenance: { source: 'x', added: '2026-11-18' },
    };
    expect(
      CatalogueFileSchema.safeParse({
        version: 1,
        entries: [{ ...base, id: 'Singara!', nutrition_dish_id: null }],
      }).success,
    ).toBe(false);
    expect(
      CatalogueFileSchema.safeParse({
        version: 1,
        entries: [{ ...base, id: 'singara', nutrition_dish_id: 'Bad Id' }],
      }).success,
    ).toBe(false);
  });

  it('rejects an empty entry list and a non-positive version', () => {
    expect(CatalogueFileSchema.safeParse({ version: 1, entries: [] }).success).toBe(false);
    expect(
      CatalogueFileSchema.safeParse({
        version: 0,
        entries: [
          {
            id: 'singara',
            name_en: 'Singara',
            name_bn: null,
            aliases: [],
            category: 'Snacks',
            nutrition_dish_id: null,
            provenance: { source: 'x', added: '2026-11-18' },
          },
        ],
      }).success,
    ).toBe(false);
  });
});
