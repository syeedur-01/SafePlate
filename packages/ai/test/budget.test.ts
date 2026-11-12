import { describe, it, expect } from 'vitest';
import { createBudgetGuard } from '../src/budget';

describe('createBudgetGuard', () => {
  it('allows up to the maximum then refuses', () => {
    const g = createBudgetGuard({ maxPerDay: 2, now: () => 0 });
    expect([g.tryConsume(), g.tryConsume(), g.tryConsume()]).toEqual([true, true, false]);
    expect(g.remaining()).toBe(0);
  });
  it('resets on a new UTC day', () => {
    let t = Date.UTC(2026, 9, 26, 23, 59);
    const g = createBudgetGuard({ maxPerDay: 1, now: () => t });
    expect(g.tryConsume()).toBe(true);
    expect(g.tryConsume()).toBe(false);
    t = Date.UTC(2026, 9, 27, 0, 1);
    expect(g.tryConsume()).toBe(true);
  });
});
