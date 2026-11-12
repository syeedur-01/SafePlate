import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const toml = readFileSync(fileURLToPath(new URL('../wrangler.toml', import.meta.url)), 'utf8');

describe('wrangler production config', () => {
  it('points at the worker entry', () => {
    expect(toml).toContain('main = "src/worker.ts"');
  });
  it('does not enable the spike endpoint', () => {
    expect(toml).not.toContain('ENABLE_SPIKE');
  });
  it('contains no credentials', () => {
    expect(toml).not.toContain('API_KEY =');
    expect(toml).not.toContain('SECRET');
    expect(toml).not.toContain('TOKEN =');
  });
});
