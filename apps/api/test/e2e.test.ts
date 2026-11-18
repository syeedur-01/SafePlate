// e2e.test.ts: scan request -> API -> engine for every mock fixture, in-process, no network
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { AnalysisResultSchema, ScanResultSchema } from '@sp/contracts';
import { makeProfile } from '@sp/contracts/testing';
import { MockProvider } from '@sp/ai';
import { analyze, type AllergenKeywords } from '@sp/engine';
import {
  getDishes,
  getIngredients,
  ingredientsById,
  getSafetyRules,
  getHealthRules,
} from '@sp/knowledge';

import { createApp } from '../src/app';

// The allergen keywords come from the committed knowledge data file; the knowledge
// package has no loader for it yet, so the test reads it directly like the other
// data-reading tests do.
const allergenKeywords = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../packages/knowledge/data/allergen-keywords.json', import.meta.url),
    ),
    'utf8',
  ),
) as AllergenKeywords;

type ForceFixture = NonNullable<ConstructorParameters<typeof MockProvider>[0]>['forceFixture'];
const FIXTURE_DIR = fileURLToPath(new URL('../../../fixtures/mock-scan/', import.meta.url));
const STEMS = readdirSync(FIXTURE_DIR)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.replace(/\.json$/, ''));

// Fixed values keep the engine call pure: nothing in this test depends on the wall clock.
const TODAY = '2026-06-01';
const CONTEXT = { place: 'home', storage: 'unknown', hoursSinceCooked: null } as const;

/** Returns a scan result from the API app for one forced fixture stem. */
async function scanThroughApi(stem: string) {
  const app = createApp({
    allowedOrigin: 'http://localhost:5173',
    maxBodyBytes: 2_000_000,
    provider: new MockProvider({ forceFixture: stem as ForceFixture }),
    catalogue: [],
  });
  const res = await app.request('/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: stem.startsWith('label') ? 'label' : 'dish',
      imageBase64: '/9j/4AAQ' + 'Q'.repeat(292),
      mimeType: 'image/jpeg',
      context: CONTEXT,
    }),
  });
  expect(res.status).toBe(200);
  return ScanResultSchema.parse(await res.json());
}

describe('end-to-end pipeline over every mock fixture', () => {
  it.each(STEMS)('%s: scan through the API and analyze with real data', async (stem) => {
    const scanResult = await scanThroughApi(stem);

    if (scanResult.kind === 'dish') {
      const dishId = scanResult.candidates.find((c) => c.dishId !== null)?.dishId ?? null;
      // The dish-unknown fixture models the AI seeing no known dish (every candidate
      // has dishId: null), so there is no dish to analyze; the scan itself is still
      // asserted above and analyze runs on every fixture that names a dish.
      if (dishId === null) return;
      const result = analyze({
        scanKind: 'dish',
        dishId,
        dishes: getDishes(),
        ingredients: ingredientsById(getIngredients()),
        observations: {
          spoilageSigns: scanResult.observations.spoilageSigns,
          imageQuality: scanResult.observations.imageQuality,
        },
        context: CONTEXT,
        label: null,
        profile: makeProfile(),
        safetyRules: getSafetyRules(),
        healthRules: getHealthRules(),
        allergenKeywords,
        today: TODAY,
      });
      expect(() => AnalysisResultSchema.parse(result)).not.toThrow();
    } else {
      const result = analyze({
        scanKind: 'label',
        dishId: null,
        dishes: getDishes(),
        ingredients: ingredientsById(getIngredients()),
        observations: {
          spoilageSigns: scanResult.observations.spoilageSigns,
          imageQuality: scanResult.observations.imageQuality,
        },
        context: CONTEXT,
        label: {
          ingredientsText: scanResult.ingredientsText,
          declaredAllergens: scanResult.declaredAllergens,
          nutritionPer100g: scanResult.nutritionPer100g,
          expiryDate: scanResult.expiryDate,
        },
        profile: makeProfile(),
        safetyRules: getSafetyRules(),
        healthRules: getHealthRules(),
        allergenKeywords,
        today: TODAY,
      });
      expect(() => AnalysisResultSchema.parse(result)).not.toThrow();
    }
  });
});
