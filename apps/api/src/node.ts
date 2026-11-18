import { serve } from '@hono/node-server';
import { getDishes } from '@sp/knowledge';
import { MemoryScanCache } from '@sp/ai';
import { configFromEnv } from './config';
import { createApp } from './app';
import { providerFromEnv } from './provider';

const portEnv = process.env['PORT'] === undefined ? Number.NaN : Number(process.env['PORT']);
const port = Number.isFinite(portEnv) && portEnv > 0 ? portEnv : 8787;

// Failing fast at boot: an unset AI_PROVIDER must stop the process, not serve mock data.
const provider = providerFromEnv(process.env);

const app = createApp({
  ...configFromEnv(process.env),
  provider,
  dishes: getDishes().map((dish) => ({
    id: dish.id,
    name_en: dish.name_en,
    name_bn: dish.name_bn,
    aliases: dish.aliases,
  })),
  cache: new MemoryScanCache(),
});

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    process.stdout.write(`api listening on http://localhost:${info.port}\n`);
  },
);
