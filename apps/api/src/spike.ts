import type { Hono } from 'hono';
import { ScanRequestSchema } from '@sp/contracts';

/** Registers POST /api/_spike/echo, which parses a ScanRequest and echoes its size and elapsed time. No AI call. */
export function registerSpikeRoute(app: Hono): void {
  app.post('/api/_spike/echo', async (c) => {
    const started = Date.now();
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ error: { code: 'bad_request', message: 'body is not valid JSON' } }, 400);
    }
    const parsed = ScanRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { error: { code: 'bad_request', message: 'body is not a valid scan request' } },
        400,
      );
    }
    return c.json({
      ok: true,
      base64Chars: parsed.data.imageBase64.length,
      ms: Date.now() - started,
    });
  });
}
