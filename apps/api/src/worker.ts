import dishesJson from '@sp/knowledge/data/normalized/dishes.json';
import { NormalizedDishesFileSchema } from '@sp/contracts';
import { createApp } from './app';
import { configFromEnv, type Env } from './config';
import { providerFromEnv } from './provider';

// Workers have no filesystem, so the dish data is bundled into the Worker at build
// time (this JSON import) instead of calling getDishes(), which reads files with
// node:fs at runtime and cannot run here. The schema parse keeps the validated-data
// guarantee that getDishes() provided.
const dishes = NormalizedDishesFileSchema.parse(dishesJson).dishes;

/** Cloudflare Workers entry: serves the API app with config from the deployment's environment. */
export default {
  fetch(request: Request, env: Env) {
    return createApp({
      ...configFromEnv(env),
      provider: providerFromEnv(env),
      dishes: dishes.map((dish) => ({
        id: dish.id,
        name_en: dish.name_en,
        name_bn: dish.name_bn,
        aliases: dish.aliases,
      })),
    }).fetch(request);
  },
};
