import { getDishes } from '@sp/knowledge';
import { createApp } from './app';
import { configFromEnv, type Env } from './config';
import { providerFromEnv } from './provider';

/** Cloudflare Workers entry: serves the API app with config from the deployment's environment. */
export default {
  fetch(request: Request, env: Env) {
    const dishes = getDishes().map((dish) => ({
      id: dish.id,
      name_en: dish.name_en,
      name_bn: dish.name_bn,
      aliases: dish.aliases,
    }));
    return createApp({
      ...configFromEnv(env),
      provider: providerFromEnv(env),
      dishes,
    }).fetch(request);
  },
};
