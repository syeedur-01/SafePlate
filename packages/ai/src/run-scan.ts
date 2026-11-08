import { ScanResultSchema, type ScanRequest, type ScanResult } from '@sp/contracts';
import { ParseError, AiInvalidOutputError } from './errors';
import { parseModelJson } from './parse';
import type { ProviderContext, VisionProvider } from './provider';

const MAX_ATTEMPTS = 2;

/** Calls the provider, validates the result, retries once, and sanitizes unknown dish ids to null. */
export async function runScan(
  provider: VisionProvider,
  req: ScanRequest,
  ctx: ProviderContext,
): Promise<ScanResult> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const raw = await provider.analyze(req, ctx); // provider errors are never retried
    let candidate: unknown = raw;
    if (typeof raw === 'string') {
      try {
        candidate = parseModelJson(raw);
      } catch (error) {
        if (!(error instanceof ParseError)) throw error;
        candidate = undefined; // unparseable text counts as an invalid attempt
      }
    }
    const result = validate(candidate, provider.name);
    if (result !== null) return sanitize(result, ctx);
  }
  throw new AiInvalidOutputError('the AI returned invalid output on both attempts');
}

/** Returns the provider output stamped with provider name and cached=false, or null when invalid. */
function validate(candidate: unknown, providerName: string): ScanResult | null {
  if (candidate === null || typeof candidate !== 'object') return null;
  const stamped = { ...candidate, provider: providerName, cached: false };
  const parsed = ScanResultSchema.safeParse(stamped);
  return parsed.success ? parsed.data : null;
}

/** Returns the result with candidate dish ids that are unknown to the context replaced by null. */
function sanitize(result: ScanResult, ctx: ProviderContext): ScanResult {
  const knownIds = new Set(ctx.dishes.map((dish) => dish.id));
  if (result.kind !== 'dish') return result;
  return {
    ...result,
    kind: 'dish',
    candidates: result.candidates.map((candidate) =>
      candidate.dishId !== null && !knownIds.has(candidate.dishId)
        ? { ...candidate, dishId: null }
        : candidate,
    ),
  };
}
