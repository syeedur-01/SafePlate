import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const rootPkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8'),
);

describe('workspace', () => {
  it('has a check script that runs typecheck, lint and tests', () => {
    expect(rootPkg.scripts.check).toContain('typecheck');
    expect(rootPkg.scripts.check).toContain('lint');
    expect(rootPkg.scripts.check).toContain('test');
  });
  it('is private and pins the package manager', () => {
    expect(rootPkg.private).toBe(true);
    expect(rootPkg.packageManager).toMatch(/^pnpm@/);
  });
});
