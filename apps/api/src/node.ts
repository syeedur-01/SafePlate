import { serve } from '@hono/node-server';
import { getCatalogue } from '@sp/knowledge';
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
  catalogue: getCatalogue().entries.map((entry) => ({
    id: entry.id,
    name_en: entry.name_en,
    name_bn: entry.name_bn,
    aliases: entry.aliases,
    category: entry.category,
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
