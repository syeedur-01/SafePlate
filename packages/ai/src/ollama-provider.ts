import type { ScanRequest } from '@sp/contracts';
import type { ProviderContext, VisionProvider } from './provider';
import { buildDishPrompt, buildLabelPrompt } from './prompts';
import { ParseError, AiInvalidOutputError, AiUnavailableError } from './errors';
import { parseModelJson } from './parse';

const DEFAULT_TIMEOUT_MS = 120_000;

export interface OllamaOptions {
  /** Base URL of a locally running Ollama server; never a production dependency. */
  baseUrl?: string;
  model: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

interface OllamaChatResponse {
  message?: { content?: unknown };
  error?: string;
}

/** Returns the assistant message content when it is a string, else an empty string. */
function messageText(body: OllamaChatResponse): string {
  const content = body.message?.content;
  return typeof content === 'string' ? content : '';
}

/**
 * Talks to a locally running Ollama server through the same VisionProvider contract as the
 * cloud providers. Evaluation/experiment only: never wire this into the production Worker
 * configuration. The prompt carries dish context only and no user-identifying data.
 */
export class OllamaProvider implements VisionProvider {
  readonly name = 'ollama';
  readonly model: string;

  constructor(private readonly opts: OllamaOptions) {
    this.model = opts.model;
  }

  async analyze(req: ScanRequest, ctx: ProviderContext): Promise<unknown> {
    const prompt = req.kind === 'dish' ? buildDishPrompt(ctx, req.context) : buildLabelPrompt();
    const fetchFn = this.opts.fetchFn ?? fetch;
    const base = (this.opts.baseUrl ?? 'http://localhost:11434').replace(/\/+$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      let response: Response;
      try {
        response = await fetchFn(`${base}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: this.opts.model,
            stream: false,
            format: 'json',
            messages: [{ role: 'user', content: prompt, images: [req.imageBase64] }],
            options: { temperature: 0.1 },
          }),
          signal: controller.signal,
        });
      } catch {
        // network failure or timeout; never log the image or any request detail
        throw new AiUnavailableError('ollama request failed before a response arrived');
      }
      if (!response.ok) {
        throw new AiUnavailableError(`ollama request failed with status ${response.status}`);
      }
      let body: OllamaChatResponse;
      try {
        body = (await response.json()) as OllamaChatResponse;
      } catch {
        throw new AiUnavailableError('ollama response body was not valid JSON');
      }
      if (typeof body.error === 'string') {
        throw new AiUnavailableError(`ollama reported an error`);
      }
      const text = messageText(body);
      if (text.trim() === '') throw new AiInvalidOutputError('ollama returned no text');
      try {
        return parseModelJson(text);
      } catch (error) {
        if (error instanceof ParseError) {
          throw new AiInvalidOutputError('ollama response contained no parsable JSON');
        }
        throw error;
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
