import type { ScanRequest } from '@sp/contracts';
import { AiInvalidOutputError, AiUnavailableError, RateLimitedError } from './errors';
import { parseModelJson } from './parse';
import type { ProviderContext, VisionProvider } from './provider';
import { buildDishPrompt, buildLabelPrompt } from './prompts';

const DEFAULT_TIMEOUT_MS = 25_000;
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiOptions {
  apiKey: string;
  model: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
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

/** Calls the Gemini generateContent REST API with the scan image and returns the parsed model JSON. */
export class GeminiProvider implements VisionProvider {
  readonly name = 'gemini';

  constructor(private readonly opts: GeminiOptions) {}

  async analyze(req: ScanRequest, ctx: ProviderContext): Promise<unknown> {
    const prompt = req.kind === 'dish' ? buildDishPrompt(ctx, req.context) : buildLabelPrompt();
    const fetchFn = this.opts.fetchFn ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let text: string;
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
        throw new AiUnavailableError('gemini request failed before a response arrived');
      }
      if (response.status === 429) throw new RateLimitedError('gemini rate limit reached');
      if (!response.ok) {
        throw new AiUnavailableError(
          `gemini request failed with status ${response.status}`,
          response.status,
        );
      }
      try {
        text = candidateText(await response.json());
      } catch {
        // non-JSON body on a 2xx response; never log the response body
        throw new AiUnavailableError('gemini response body was not valid JSON', response.status);
      }
    } finally {
      clearTimeout(timer);
    }
    if (text.trim() === '') throw new AiInvalidOutputError('gemini returned no text');
    return parseModelJson(text);
  }
}
