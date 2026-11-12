import { createBudgetGuard } from '@sp/ai';
import type { BudgetGuard, DishPromptEntry, ScanCache, VisionProvider } from '@sp/ai';

export interface AppConfig {
  allowedOrigin: string;
  maxBodyBytes: number;
  /** Optional so callers not using the spike do not need to set it; defaults to false. */
  enableSpike?: boolean;
  /** Optional so the P1 tests still compile; the scan route answers 503 when it is missing. */
  provider?: VisionProvider;
  /** Optional dish context for the vision provider; defaults to an empty list. */
  dishes?: DishPromptEntry[];
  /** Optional scan result cache; without it every request reaches the provider. */
  cache?: ScanCache;
  /** Optional daily AI call cap; without it the scan route applies the default cap. */
  budget?: BudgetGuard;
}
export type Env = Record<string, string | undefined>;

const DEFAULT_ALLOWED_ORIGIN = 'http://localhost:5173';
const DEFAULT_MAX_BODY_BYTES = 2_000_000;
export const DEFAULT_DAILY_AI_BUDGET = 200;

/** Returns the config from environment variables with defaults (origin http://localhost:5173, 2000000 bytes, daily AI budget 200 when uncapped by the caller). */
export function configFromEnv(env: Env): AppConfig {
  const origin = env['ALLOWED_ORIGIN'];
  const bodyBytes = env['MAX_BODY_BYTES'];
  const parsedBodyBytes = bodyBytes === undefined ? Number.NaN : Number(bodyBytes);
  const dailyBudget = env['DAILY_AI_BUDGET'];
  const parsedDailyBudget = dailyBudget === undefined ? Number.NaN : Number(dailyBudget);
  return {
    allowedOrigin: origin === undefined || origin === '' ? DEFAULT_ALLOWED_ORIGIN : origin,
    maxBodyBytes:
      Number.isFinite(parsedBodyBytes) && parsedBodyBytes > 0
        ? parsedBodyBytes
        : DEFAULT_MAX_BODY_BYTES,
    enableSpike: env['ENABLE_SPIKE'] === '1',
    budget:
      Number.isFinite(parsedDailyBudget) && parsedDailyBudget > 0
        ? createBudgetGuard({ maxPerDay: parsedDailyBudget })
        : undefined,
  };
}
