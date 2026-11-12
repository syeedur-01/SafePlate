import { describe, it, expect } from 'vitest';
import { providerFromEnv } from '../src/provider';
describe('providerFromEnv', () => {
  it('defaults to mock', () => {
    expect(providerFromEnv({}).name).toBe('mock');
  });
  it('requires key and model for gemini', () => {
    expect(() => providerFromEnv({ AI_PROVIDER: 'gemini' })).toThrow('GEMINI_API_KEY');
    expect(() => providerFromEnv({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' })).toThrow(
      'GEMINI_MODEL',
    );
    expect(
      providerFromEnv({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' }).name,
    ).toBe('gemini');
  });
  it('rejects unknown providers', () => {
    expect(() => providerFromEnv({ AI_PROVIDER: 'foo' })).toThrow();
  });
});
