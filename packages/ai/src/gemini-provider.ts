import type { ScanRequest } from '@sp/contracts';
import { AiInvalidOutputError, AiUnavailableError, ParseError, RateLimitedError } from './errors';
import { parseModelJson } from './parse';
import type { ProviderContext, VisionProvider } from './provider';
import { buildDishPrompt, buildLabelPrompt } from './prompts';

const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const MAX_JITTER_MS = 250;
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiOptions {
  apiKey: string;
  model: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** Total attempts per analyze call (first try + retries); default 3. */
  maxAttempts?: number;
  /** Injectable delay so tests are deterministic; defaults to a real sleep. */
  sleepFn?: (ms: number) => Promise<void>;
  /** Injectable jitter source in [0,1) so tests are deterministic; defaults to Math.random. */
  jitterFn?: () => number;
}

/** Joins the text parts of the first candidate of a generateContent response body. */
function candidateText(body: unknown): string {
  if (body === null || typeof body !== 'object') return '';
  const parts = (body as { candidates?: unknown })['candidates'];
  if (!Array.isArray(parts) || parts.length === 0) return '';
  const first = parts[0];
  if (first === null || typeof first !== 'object') return '';
  const content = (first as { content?: unknown })['content'];
  if (content === null || typeof content !== 'object') return '';
  const partList = (content as { parts?: unknown })['parts'];
  const texts: string[] = [];
  if (Array.isArray(partList)) {
    for (const part of partList) {
      if (part !== null && typeof part === 'object') {
        const text = (part as { text?: unknown })['text'];
        if (typeof text === 'string') texts.push(text);
      }
    }
  }
  return texts.join('');
}

type AttemptError =
  { kind: 'network' } | { kind: 'http'; status: number; retryAfterMs: number | null };

type AttemptResult = { ok: true; value: unknown } | { ok: false; error: AttemptError };

/** Returns true for failures worth retrying: network errors, 429 and 5xx responses. */
function isRetryable(error: AttemptError): boolean {
  if (error.kind === 'network') return true;
  return error.kind === 'http' && (error.status === 429 || error.status >= 500);
}

/** Parses a Retry-After header (seconds) into milliseconds; null when absent or malformed. */
function retryAfterMs(headers: Headers): number | null {
  const value = headers.get('retry-after');
  if (value === null) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds * 1000) : null;
}

/** Calls the Gemini generateContent REST API with bounded retries and returns the parsed model JSON. */
export class GeminiProvider implements VisionProvider {
  readonly name = 'gemini';
  readonly model: string;

  constructor(private readonly opts: GeminiOptions) {
    this.model = opts.model;
  }

  async analyze(req: ScanRequest, ctx: ProviderContext): Promise<unknown> {
    const prompt = req.kind === 'dish' ? buildDishPrompt(ctx, req.context) : buildLabelPrompt();
    const fetchFn = this.opts.fetchFn ?? fetch;
    const maxAttempts = this.opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const sleep = this.opts.sleepFn ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    const jitter = this.opts.jitterFn ?? Math.random;

    let lastError: AttemptError | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.attemptOnce(fetchFn, prompt, req);
      if (result.ok) return result.value;
      lastError = result.error;
      if (!isRetryable(lastError)) break;
      if (attempt < maxAttempts) {
        const delay =
          lastError.kind === 'http' && lastError.retryAfterMs !== null
            ? lastError.retryAfterMs
            : BASE_DELAY_MS * 2 ** (attempt - 1) + jitter() * MAX_JITTER_MS;
        await sleep(delay);
      }
    }
    this.throwMapped(lastError);
  }

  /** Throws the stable error type for a final attempt failure; the loop guarantees non-null. */
  private throwMapped(lastError: AttemptError | null): never {
    if (lastError !== null && lastError.kind === 'http') {
      if (lastError.status === 429) throw new RateLimitedError('gemini rate limit reached');
      throw new AiUnavailableError(
        `gemini request failed with status ${lastError.status}`,
        lastError.status,
      );
    }
    throw new AiUnavailableError('gemini request failed before a response arrived');
  }

  /** Runs one request attempt; terminal output problems throw AiInvalidOutputError directly. */
  private async attemptOnce(
    fetchFn: typeof fetch,
    prompt: string,
    req: ScanRequest,
  ): Promise<AttemptResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      let response: Response;
      try {
        response = await fetchFn(`${BASE_URL}/${this.opts.model}:generateContent`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': this.opts.apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: req.mimeType, data: req.imageBase64 } },
                ],
              },
            ],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
          }),
          signal: controller.signal,
        });
      } catch {
        // network failure or timeout; never log the key, the image or any request detail
        return { ok: false, error: { kind: 'network' } };
      }
      if (response.status === 429) {
        return {
          ok: false,
          error: { kind: 'http', status: 429, retryAfterMs: retryAfterMs(response.headers) },
        };
      }
      if (!response.ok) {
        return {
          ok: false,
          error: {
            kind: 'http',
            status: response.status,
            retryAfterMs: response.status >= 500 ? retryAfterMs(response.headers) : null,
          },
        };
      }
      try {
        const text = candidateText(await response.json());
        if (text.trim() === '') throw new AiInvalidOutputError('gemini returned no text');
        return { ok: true, value: parseModelJson(text) };
      } catch (error) {
        if (error instanceof AiInvalidOutputError) throw error;
        if (error instanceof ParseError) {
          // A 2xx body the model produced but that holds no JSON is terminal invalid output.
          throw new AiInvalidOutputError('gemini response contained no parsable JSON');
        }
        // non-JSON body on a 2xx response; never log the response body
        throw new AiUnavailableError('gemini response body was not valid JSON', response.status);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
