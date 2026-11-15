// @vitest-environment node
// (this test reads a file from disk; the jsdom environment emulates import.meta.url
// as a browser URL, which fileURLToPath cannot use)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
describe('pages redirects', () => {
  it('sends every path to index.html', () => {
    expect(
      readFileSync(fileURLToPath(new URL('../public/_redirects', import.meta.url)), 'utf8').trim(),
    ).toBe('/* /index.html 200');
  });
});
