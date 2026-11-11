import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { SafetyRulesFileSchema } from '@sp/contracts';
import { getSources } from '../src';
const file = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../data/proposals/safety-rules-proposals.json', import.meta.url)),
    'utf8',
  ),
);
describe('safety rule proposals', () => {
  const rules = SafetyRulesFileSchema.parse({ rules: file.rules }).rules;
  const ids = new Set(getSources().map((s) => s.id));
  it('has at least one rule and unique ids', () => {
    expect(rules.length).toBeGreaterThan(0);
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
  });
  it('every rule is draft, cited, and explained', () => {
    for (const r of rules) {
      expect(r.status).toBe('draft');
      expect(r.sourceRef && ids.has(r.sourceRef)).toBeTruthy();
      expect(r.basis && r.basis.length > 10).toBeTruthy();
    }
  });
  it('uses the key conventions', () => {
    for (const r of rules) {
      expect(r.labelKey.startsWith('safety.')).toBe(true);
      for (const m of r.mitigationKeys) expect(m.startsWith('mitigation.')).toBe(true);
    }
  });
});
