import {
  ApiErrorSchema,
  ScanRequestSchema,
  ScanResultSchema,
  type ScanRequest,
  type ScanResult,
} from '@sp/contracts';
import dishFixture from '../../../../fixtures/mock-scan/dish-kacchi-biryani.json';
import labelFixture from '../../../../fixtures/mock-scan/label-snack.json';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_ERROR_MESSAGE = 'The AI service is unavailable.';

/** Returns a typed error for failed scan requests. */
export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ScanOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

async function postWithTimeout(
  url: string,
  init: RequestInit,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } catch {
    throw new ApiClientError('ai_unavailable', DEFAULT_ERROR_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
}

/** Returns the validated scan result, or throws ApiClientError for API failures. */
export async function scan(req: ScanRequest, opts: ScanOptions = {}): Promise<ScanResult> {
  const parsedRequest = ScanRequestSchema.parse(req);
  const baseUrl = (opts.baseUrl ?? import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');
  const doFetch =
    opts.fetchFn ??
    ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
  const response = await postWithTimeout(
    `${baseUrl}/api/scan`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsedRequest),
    },
    doFetch,
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ApiClientError('internal', 'The server returned an unexpected response.');
    }
    const parsedError = ApiErrorSchema.safeParse(payload);
    if (!parsedError.success) {
      throw new ApiClientError('internal', 'The server returned an unexpected response.');
    }
    throw new ApiClientError(parsedError.data.error.code, parsedError.data.error.message);
  }

  const payload: unknown = await response.json();
  return ScanResultSchema.parse(payload);
}

/** Returns a validated mock scan fixture for the requested kind. */
export function mockScan(kind: 'dish' | 'label'): ScanResult {
  return ScanResultSchema.parse(kind === 'dish' ? dishFixture : labelFixture);
}
