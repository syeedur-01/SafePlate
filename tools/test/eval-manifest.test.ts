import { describe, it, expect } from 'vitest';
import { validateBenchmarkManifest, validateLabelMap } from '../src/eval-manifest';

const entry = {
  imageId: 'h1',
  imagePath: 'kacchi/001.jpg',
  kind: 'dish',
  datasetLabel: 'kacchi',
  split: 'dev',
  source: 'BD-Food33 v1 (DOI 10.17632/8wt48bjmx3.1)',
  licence: 'CC0-1.0',
  attribution: null,
  mappedDishId: 'kacchi-biryani',
  notes: null,
};

describe('validateBenchmarkManifest', () => {
  it('accepts a valid manifest', () => {
    expect(validateBenchmarkManifest([entry])).toEqual([]);
  });

  it('rejects a non-array or an empty manifest', () => {
    expect(validateBenchmarkManifest({}).length).toBeGreaterThan(0);
    expect(validateBenchmarkManifest([]).length).toBeGreaterThan(0);
  });

  it('rejects entries with a missing or wrongly typed field', () => {
    expect(validateBenchmarkManifest([{ ...entry, imageId: 1 }]).length).toBeGreaterThan(0);
    expect(validateBenchmarkManifest([{ ...entry, split: 'train' }]).length).toBeGreaterThan(0);
    expect(validateBenchmarkManifest([{ ...entry, kind: 'ocr' }]).length).toBeGreaterThan(0);
    expect(validateBenchmarkManifest([{ ...entry, licence: '' }]).length).toBeGreaterThan(0);
    expect(validateBenchmarkManifest([{ ...entry, attribution: 5 }]).length).toBeGreaterThan(0);
  });

  it('rejects an imagePath that escapes the dataset directory', () => {
    expect(
      validateBenchmarkManifest([{ ...entry, imagePath: '../outside.jpg' }]).length,
    ).toBeGreaterThan(0);
    expect(
      validateBenchmarkManifest([{ ...entry, imagePath: '/abs/path.jpg' }]).length,
    ).toBeGreaterThan(0);
    expect(
      validateBenchmarkManifest([{ ...entry, imagePath: 'a\\..\\..\\x.jpg' }]).length,
    ).toBeGreaterThan(0);
  });

  it('rejects duplicate imageIds', () => {
    expect(
      validateBenchmarkManifest([entry, { ...entry, imagePath: 'kacchi/002.jpg' }]).length,
    ).toBeGreaterThan(0);
  });
});

describe('validateLabelMap', () => {
  const map = [
    { datasetLabel: 'kacchi', safePlateDishId: 'kacchi-biryani', status: 'approved', reason: null },
    {
      datasetLabel: 'mystery-curry',
      safePlateDishId: null,
      status: 'proposed',
      reason: 'no catalogue match',
    },
  ];

  it('accepts a valid map with mapped and unmapped labels', () => {
    expect(validateLabelMap(map)).toEqual([]);
  });

  it('rejects duplicate dataset labels', () => {
    expect(validateLabelMap([map[0]!, map[0]!]).length).toBeGreaterThan(0);
  });

  it('rejects a dish id that is not a catalogue-style slug', () => {
    expect(
      validateLabelMap([{ ...map[0]!, safePlateDishId: 'Kacchi Biryani!' }]).length,
    ).toBeGreaterThan(0);
  });

  it('rejects an unmapped label that is not proposed', () => {
    expect(validateLabelMap([{ ...map[1]!, status: 'approved' }]).length).toBeGreaterThan(0);
  });
});
