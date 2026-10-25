import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { ScanResultSchema } from '../src';
import { RawDishesFileSchema } from '../src/knowledge';

const dir = fileURLToPath(new URL('../../../fixtures/mock-scan/', import.meta.url));
const dishes = RawDishesFileSchema.parse(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../knowledge/data/source/dishes.json', import.meta.url)),
      'utf8',
    ),
  ),
).dishes;
const ids = new Set(dishes.map((d) => d.id));
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('mock scan fixtures', () => {
  it('has at least 6 fixtures', () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });
  for (const f of files) {
    it(`${f} is a valid ScanResult`, () => {
      const parsed = ScanResultSchema.parse(JSON.parse(readFileSync(dir + f, 'utf8')));
      if (parsed.kind === 'dish') {
        for (const c of parsed.candidates)
          if (c.dishId !== null) expect(ids.has(c.dishId)).toBe(true);
      }
    });
  }
});
