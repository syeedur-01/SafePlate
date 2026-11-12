import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppConfig } from './config';
import { registerScanRoute } from './scan-route';
import { registerSpikeRoute } from './spike';

const VERSION = '0.1.0';

/** Returns the API app. Routes are added by later cards on top of this skeleton. */
export function createApp(config: AppConfig): Hono {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: (origin) => (origin === config.allowedOrigin ? origin : null),
    }),
  );

  app.use('/api/*', async (c, next) => {
    const contentLength = c.req.header('content-length');
    const bodyBytes = contentLength === undefined ? Number.NaN : Number(contentLength);
    if (bodyBytes > config.maxBodyBytes) {
      return c.json({ error: { code: 'too_large', message: 'request body is too large' } }, 413);
    }
    await next();
  });

  app.get('/api/health', (c) => c.json({ ok: true, version: VERSION }));

  registerScanRoute(app, config);

  if (config.enableSpike === true) {
    registerSpikeRoute(app); // deploy spike only; never enabled in production by default
  }

  app.notFound((c) => c.json({ error: { code: 'bad_request', message: 'not found' } }, 404));

  app.onError((_error, c) =>
    c.json({ error: { code: 'internal', message: 'internal error' } }, 500),
  );

  return app;
}
