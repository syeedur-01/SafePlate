import { createApp } from './app';
import { configFromEnv, type Env } from './config';

/** Cloudflare Workers entry: serves the API app with config from the deployment's environment. */
export default {
  fetch(request: Request, env: Env) {
    return createApp(configFromEnv(env)).fetch(request);
  },
};
