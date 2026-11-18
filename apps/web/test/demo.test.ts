import { describe, it, expect } from 'vitest';
import { AnalysisResultSchema } from '@sp/contracts';
import { SCENARIOS } from '../src/demo/scenarios';
import { runScenario } from '../src/demo/run-scenario';

describe('demo scenarios', () => {
  it('has four scenarios with unique ids', () => {
    expect(SCENARIOS).toHaveLength(4);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(4);
  });
  it('runs the real engine and validates for every scenario', () => {
    for (const s of SCENARIOS)
      expect(AnalysisResultSchema.safeParse(runScenario(s, '2026-10-30')).success, s.id).toBe(true);
  });
  it('puts an allergen warning first in the allergy scenarios', () => {
    for (const id of ['label-with-milk-allergy', 'fish-allergy-bhorta']) {
      const s = SCENARIOS.find((x) => x.id === id)!;
      expect(runScenario(s, '2026-10-30').warnings[0]?.kind, id).toBe('allergen');
    }
  });
  it('always carries the chemical-limit notice', () => {
    for (const s of SCENARIOS)
      expect(runScenario(s, '2026-10-30').safety.notices[0]).toBe('notice.chemical_limit');
  });
  it('does not change the saved profile', () => {
    localStorage.setItem('sp.profile.v1', 'SENTINEL');
    for (const s of SCENARIOS) runScenario(s, '2026-10-30');
    expect(localStorage.getItem('sp.profile.v1')).toBe('SENTINEL');
  });
});
