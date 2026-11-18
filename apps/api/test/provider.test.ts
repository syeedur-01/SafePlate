import { describe, it, expect } from 'vitest';
import { providerFromEnv } from '../src/provider';
describe('providerFromEnv', () => {
  it('refuses to default to mock when AI_PROVIDER is unset', () => {
    expect(() => providerFromEnv({})).toThrow('AI_PROVIDER must be set explicitly');
    expect(() => providerFromEnv({ AI_PROVIDER: '' })).toThrow(
      'AI_PROVIDER must be set explicitly',
    );
  });
  it('uses mock only when explicitly selected', () => {
    expect(providerFromEnv({ AI_PROVIDER: 'mock' }).name).toBe('mock');
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
