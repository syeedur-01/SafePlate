export interface BudgetGuard {
  tryConsume(): boolean;
  remaining(): number;
}

const MS_PER_DAY = 86_400_000;

/** Returns a UTC-day call counter that refuses after maxPerDay and resets when the UTC day changes (best effort, lost on restart). */
export function createBudgetGuard(opts: { maxPerDay: number; now?: () => number }): BudgetGuard {
  const now = opts.now ?? Date.now;
  let day = utcDay(now());
  let used = 0;

  const roll = () => {
    const current = utcDay(now());
    if (current !== day) {
      day = current;
      used = 0;
    }
  };

  return {
    tryConsume() {
      roll();
      if (used >= opts.maxPerDay) return false;
      used += 1;
      return true;
    },
    remaining() {
      roll();
      return Math.max(0, opts.maxPerDay - used);
    },
  };
}

/** Returns the number of whole UTC days since the epoch for a timestamp in milliseconds. */
function utcDay(timestamp: number): number {
  return Math.floor(timestamp / MS_PER_DAY);
}
