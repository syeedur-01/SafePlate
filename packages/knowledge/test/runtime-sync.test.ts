import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { buildRuntime } from '../src/runtime';

describe('runtime export', () => {
  it('matches the committed file', () => {
    const committed = JSON.parse(
      readFileSync(fileURLToPath(new URL('../data/runtime/runtime.json', import.meta.url)), 'utf8'),
    );
    expect(buildRuntime()).toEqual(committed);
  });
});
