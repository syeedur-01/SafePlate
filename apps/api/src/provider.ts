import { GeminiProvider, MockProvider, type VisionProvider } from '@sp/ai';
import type { Env } from './config';

/**
 * Returns the vision provider selected by AI_PROVIDER, throwing when unset or incomplete.
 * Mock must be opted into explicitly; a missing AI_PROVIDER never silently becomes mock.
 */
export function providerFromEnv(env: Env): VisionProvider {
  const name = env['AI_PROVIDER'];
  if (name === undefined || name === '') {
    throw new Error(
      'AI_PROVIDER must be set explicitly to "gemini" or "mock"; refusing to default to mock',
    );
  }
  if (name === 'mock') return new MockProvider();
  if (name === 'gemini') {
    const apiKey = env['GEMINI_API_KEY'];
    if (apiKey === undefined || apiKey === '') {
      throw new Error('GEMINI_API_KEY is required when AI_PROVIDER=gemini');
    }
    const model = env['GEMINI_MODEL'];
    if (model === undefined || model === '') {
      throw new Error('GEMINI_MODEL is required when AI_PROVIDER=gemini');
    }
    return new GeminiProvider({ apiKey, model });
  }
  throw new Error(`unknown AI_PROVIDER: ${name}`);
}
