import { describe, it, expect } from 'vitest';
import { configFromEnv } from '../src/config';
describe('configFromEnv', () => {
  it('uses defaults', () => {
    expect(configFromEnv({})).toEqual({
      allowedOrigin: 'http://localhost:5173',
      maxBodyBytes: 2_000_000,
    });
  });
  it('reads overrides', () => {
    expect(configFromEnv({ ALLOWED_ORIGIN: 'https://x.pages.dev' }).allowedOrigin).toBe(
      'https://x.pages.dev',
    );
  });
});
