import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { HealthRulesFileSchema } from '@sp/contracts';
import { getSources } from '../src';
const file = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../data/proposals/health-rules-proposals.json', import.meta.url)),
    'utf8',
  ),
);
const conflicts = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../data/proposals/health-rules-conflicts.json', import.meta.url)),
    'utf8',
  ),
);
describe('health rule proposals', () => {
  const rules = HealthRulesFileSchema.parse({ rules: file.rules }).rules;
  const ids = new Set(getSources().map((s) => s.id));
  it('has at least one rule and unique ids', () => {
    expect(rules.length).toBeGreaterThan(0);
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
  });
  it('every rule is approved, cited, and explained', () => {
    for (const r of rules) {
      expect(r.status).toBe('approved');
      expect(ids.has(r.sourceRef)).toBeTruthy();
      expect(r.basis && r.basis.length > 10).toBeTruthy();
    }
  });
  it('conditions are the four supported ones', () => {
    for (const r of rules) {
      expect(['diabetes', 'hypertension', 'high_cholesterol', 'gastric']).toContain(r.condition);
    }
  });
  it('nutrient rules have a positive dailyLimit', () => {
    for (const r of rules) if (r.kind === 'nutrient') expect(r.dailyLimit).toBeGreaterThan(0);
  });
  it('conflicts parse as an array', () => {
    expect(Array.isArray(conflicts)).toBe(true);
  });
});
