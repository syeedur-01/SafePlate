export { ParseError, AiInvalidOutputError, AiUnavailableError, RateLimitedError } from './errors';
export type { DishPromptEntry, ProviderContext, VisionProvider } from './provider';
export { parseModelJson } from './parse';
export { MockProvider } from './mock-provider';
export { runScan } from './run-scan';
export { GeminiProvider, type GeminiOptions } from './gemini-provider';
export { OllamaProvider, type OllamaOptions } from './ollama-provider';
export { buildDishPrompt, buildLabelPrompt } from './prompts';
export {
  MemoryScanCache,
  KvScanCache,
  SCAN_CACHE_VERSION,
  imageCacheKey,
  type ScanCache,
  type KvNamespace,
} from './cache';
export { createBudgetGuard, type BudgetGuard } from './budget';
