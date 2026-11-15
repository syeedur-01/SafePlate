// privacy-scan.test.ts: no server code mentions the profile or health conditions
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
const dirs = ['../src/', '../../../packages/ai/src/'].map((d) =>
  fileURLToPath(new URL(d, import.meta.url)),
);
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
describe('server code never handles the health profile', () => {
  it('has no reference to profile, conditions or diabetes-type words', () => {
    const offenders = dirs
      .flatMap(files)
      .filter((f) =>
        /\b(profile|conditions|hypertension|diabetes|cholesterol|gastric)\b/i.test(
          readFileSync(f, 'utf8').replace(/\/\/.*$/gm, ''),
        ),
      );
    expect(offenders).toEqual([]);
  });
});
