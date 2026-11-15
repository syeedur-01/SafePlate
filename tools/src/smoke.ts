/** Runs the deployment smoke checks against the API_URL environment variable; human-run (never in tests). */
const API_URL = (process.env['API_URL'] ?? '').replace(/\/+$/, '');

const BASE64_200 = 'Q'.repeat(200); // any 200 characters of base64; the API only checks length

interface Check {
  name: string;
  pass: boolean;
  detail: string;
  elapsedMs: number;
}

function writeln(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function timedFetch(name: string, init: RequestInit): Promise<Check> {
  const started = Date.now();
  try {
    const res = await fetch(
      `${API_URL}${name === 'GET /api/health' ? '/api/health' : '/api/scan'}`,
      {
        ...init,
        headers: { 'content-type': 'application/json' },
      },
    );
    const elapsedMs = Date.now() - started;
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return {
        name,
        pass: false,
        detail: `status ${res.status}, body is not JSON (started with: ${text.slice(0, 80)})`,
        elapsedMs,
      };
    }
    if (name === 'GET /api/health') {
      const ok = res.status === 200 && (body as { ok?: unknown })['ok'] === true;
      return {
        name,
        pass: ok,
        detail: `status ${res.status}, body ${text.slice(0, 120)}`,
        elapsedMs,
      };
    }
    // The fake image is not a real photo, so the AI provider may legitimately answer
    // with a mapped error; what must hold is that the API answered inside its own
    // contract (200 ScanResult, or a JSON error body with a known code).
    const isResult =
      res.status === 200 && typeof body === 'object' && body !== null && 'kind' in body;
    const errorCode = (body as { error?: { code?: unknown } })['error']?.['code'];
    const knownCodes = [
      'bad_request',
      'too_large',
      'ai_unavailable',
      'ai_invalid_output',
      'rate_limited',
      'internal',
    ];
    const isMappedError =
      res.status >= 400 && typeof errorCode === 'string' && knownCodes.includes(errorCode);
    return {
      name,
      pass: isResult || isMappedError,
      detail: `status ${res.status}, body ${text.slice(0, 120)}`,
      elapsedMs,
    };
  } catch (error) {
    return {
      name,
      pass: false,
      detail: `request failed: ${error instanceof Error ? error.message : String(error)}`,
      elapsedMs: Date.now() - started,
    };
  }
}

async function main(): Promise<void> {
  if (API_URL === '') {
    writeln(
      'FAIL setup: API_URL is not set (example: API_URL=https://<worker-url> pnpm --filter @sp/tools smoke)',
    );
    process.exitCode = 1;
    return;
  }
  writeln(`smoke target: ${API_URL}`);
  const health = await timedFetch('GET /api/health', { method: 'GET' });
  const scan = await timedFetch('POST /api/scan', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'dish',
      imageBase64: BASE64_200,
      mimeType: 'image/jpeg',
      context: { place: 'home', storage: 'unknown', hoursSinceCooked: null },
    }),
  });
  for (const check of [health, scan]) {
    writeln(
      `${check.pass ? 'PASS' : 'FAIL'} ${check.name} (${check.elapsedMs} ms): ${check.detail}`,
    );
  }
  if (!health.pass || !scan.pass) process.exitCode = 1;
}

await main();

export {}; // makes this file a module so the top-level await above typechecks
