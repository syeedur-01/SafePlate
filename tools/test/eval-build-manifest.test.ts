import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  deterministicSplit,
  listImages,
  mappedDishIdFor,
  parseBuildArgs,
} from '../src/eval-build-manifest';

describe('parseBuildArgs', () => {
  it('reads all required arguments', () => {
    const args = parseBuildArgs([
      '--dataset',
      'd',
      '--map',
      'm',
      '--out',
      'o',
      '--source',
      's',
      '--licence',
      'CC0-1.0',
    ]);
    expect(args).toEqual({
      dataset: 'd',
      map: 'm',
      out: 'o',
      source: 's',
      licence: 'CC0-1.0',
      attribution: null,
    });
  });

  it('reads an optional attribution', () => {
    const args = parseBuildArgs([
      '--dataset',
      'd',
      '--map',
      'm',
      '--out',
      'o',
      '--source',
      's',
      '--licence',
      'CC-BY-4.0',
      '--attribution',
      'Author A',
    ]);
    expect(args.attribution).toBe('Author A');
  });

  it('rejects missing or unknown arguments', () => {
    expect(() => parseBuildArgs(['--dataset', 'd'])).toThrow();
    expect(() => parseBuildArgs(['--oops'])).toThrow();
  });
});

describe('deterministicSplit', () => {
  it('is stable for the same image id', () => {
    expect(deterministicSplit('abc')).toBe(deterministicSplit('abc'));
  });

  it('produces both dev and holdout across many ids', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `image-${i}`);
    const splits = new Set(ids.map(deterministicSplit));
    expect(splits.has('dev')).toBe(true);
    expect(splits.has('holdout')).toBe(true);
    const holdout = ids.filter((id) => deterministicSplit(id) === 'holdout').length;
    expect(holdout).toBeGreaterThan(20);
    expect(holdout).toBeLessThan(80);
  });
});

describe('listImages', () => {
  it('finds images recursively and sorts them, ignoring other files', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sp-eval-'));
    try {
      mkdirSync(path.join(dir, 'b-category'));
      mkdirSync(path.join(dir, 'a-category'));
      writeFileSync(path.join(dir, 'b-category', 'z.png'), 'x');
      writeFileSync(path.join(dir, 'a-category', 'm.jpg'), 'x');
      writeFileSync(path.join(dir, 'ignore.txt'), 'x');
      expect(listImages(dir)).toEqual(['a-category/m.jpg', 'b-category/z.png']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('mappedDishIdFor', () => {
  const map = new Map([
    ['kacchi', 'kacchi-biryani'],
    ['mystery', null],
  ]);
  it('returns the catalogue id for a mapped label', () => {
    expect(mappedDishIdFor('kacchi', map)).toBe('kacchi-biryani');
  });
  it('returns null for an unmapped and for an unknown label', () => {
    expect(mappedDishIdFor('mystery', map)).toBeNull();
    expect(mappedDishIdFor('unknown-label', map)).toBeNull();
  });
});
