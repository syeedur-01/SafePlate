import type { Hono } from 'hono';
import type { Context } from 'hono';
import { ScanRequestSchema } from '@sp/contracts';
import { AiInvalidOutputError, AiUnavailableError, RateLimitedError, runScan } from '@sp/ai';
import type { AppConfig } from './config';
import { sanitizeLabelResult } from './sanitize';

/** Registers POST /api/scan, which validates the request, runs the AI scan and maps failures to API codes. */
export function registerScanRoute(app: Hono, config: AppConfig): void {
  app.post('/api/scan', async (c) => {
    const provider = config.provider;
    if (provider === undefined) {
      return c.json(
        { error: { code: 'ai_unavailable', message: 'AI provider is not configured' } },
        503,
      );
    }

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ error: { code: 'bad_request', message: 'body is not valid JSON' } }, 400);
    }

    const parsed = ScanRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return c.json({ error: { code: 'bad_request', message } }, 400);
    }

    try {
      const result = await runScan(provider, parsed.data, { dishes: config.dishes ?? [] });
      if (result.kind !== parsed.data.kind) {
        return c.json(
          {
            error: {
              code: 'ai_invalid_output',
              message: 'AI output did not match the request kind',
            },
          },
          502,
        );
      }
      if (result.kind === 'label') {
        return c.json(sanitizeLabelResult(result), 200);
      }
      return c.json(result, 200);
    } catch (error) {
      return mapError(c, error);
    }
  });
}

/** Returns the API error response for a scan failure, never echoing the underlying message for unknown errors. */
function mapError(c: Context, error: unknown) {
  if (error instanceof RateLimitedError) {
    return c.json({ error: { code: 'rate_limited', message: 'rate limited' } }, 429);
  }
  if (error instanceof AiUnavailableError) {
    return c.json(
      { error: { code: 'ai_unavailable', message: 'AI provider is unavailable' } },
      502,
    );
  }
  if (error instanceof AiInvalidOutputError) {
    return c.json({ error: { code: 'ai_invalid_output', message: 'AI output was invalid' } }, 502);
  }
  return c.json({ error: { code: 'internal', message: 'internal error' } }, 500);
}
