import { serve } from '@hono/node-server';
import { configFromEnv } from './config';
import { createApp } from './app';

const portEnv = process.env['PORT'] === undefined ? Number.NaN : Number(process.env['PORT']);
const port = Number.isFinite(portEnv) && portEnv > 0 ? portEnv : 8787;

serve({ fetch: createApp(configFromEnv(process.env)).fetch, port }, (info) => {
  process.stdout.write(`api listening on http://localhost:${info.port}\n`);
});
