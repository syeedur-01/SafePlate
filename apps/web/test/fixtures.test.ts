import { describe, it, expect } from 'vitest';
import { AnalysisResultSchema, type AnalysisResult } from '@sp/contracts';
import { kacchiAnalysis } from '../src/fixtures/analysis-kacchi';
import { labelAnalysis } from '../src/fixtures/analysis-label';
import { unknownNutritionAnalysis } from '../src/fixtures/analysis-unknown-nutrition';

const fixtures: Array<[string, AnalysisResult]> = [
  ['kacchi dish', kacchiAnalysis],
  ['label', labelAnalysis],
  ['unknown nutrition', unknownNutritionAnalysis],
];

describe('web fixtures', () => {
  it.each(fixtures)('%s passes the AnalysisResult schema', (_name, fixture) => {
    expect(AnalysisResultSchema.safeParse(fixture).success).toBe(true);
  });

  it('the unknown-nutrition fixture hides every nutrient', () => {
    const nutrition = unknownNutritionAnalysis.nutrition;
    if (nutrition === null) throw new Error('fixture must have nutrition');
    const values = Object.values(nutrition.perServing);
    expect(values).toHaveLength(8);
    expect(values.every((nutrient) => nutrient.shown === false)).toBe(true);
  });
});
