import { serve } from '@hono/node-server';
import { getDishes } from '@sp/knowledge';
import { configFromEnv } from './config';
import { createApp } from './app';
import { providerFromEnv } from './provider';

const portEnv = process.env['PORT'] === undefined ? Number.NaN : Number(process.env['PORT']);
const port = Number.isFinite(portEnv) && portEnv > 0 ? portEnv : 8787;

const dishes = getDishes().map((dish) => ({
  id: dish.id,
  name_en: dish.name_en,
  name_bn: dish.name_bn,
  aliases: dish.aliases,
}));

serve(
  {
    fetch: createApp({
      ...configFromEnv(process.env),
      provider: providerFromEnv(process.env),
      dishes,
    }).fetch,
    port,
  },
  (info) => {
    process.stdout.write(`api listening on http://localhost:${info.port}\n`);
  },
);
