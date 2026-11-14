// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { uiStrings } from '../src/i18n/ui-strings';
import { getMessages } from '@sp/knowledge';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [];
  });
const keys = new Set(
  files(root).flatMap((f) =>
    [...readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([a-z0-9_.]+)'/g)].map((m) => m[1]!),
  ),
);
describe('i18n keys used in components', () => {
  it('exist in both languages (ui strings or knowledge messages)', () => {
    const messages = getMessages();
    const missing = [...keys].filter(
      (k) => !((uiStrings.en[k] && uiStrings.bn[k]) || (messages[k]?.en && messages[k]?.bn)),
    );
    expect(missing).toEqual([]);
  });
});
