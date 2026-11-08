import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GeminiProvider } from '@sp/ai';
import { ScanRequestSchema } from '@sp/contracts';

const MIME_BY_EXTENSION: Record<string, 'image/jpeg' | 'image/png' | 'image/webp'> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** Returns the process environment with variables from the repo-root .env file added when not already set. */
function envWithDotenv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  let lines: string[] = [];
  try {
    lines = readFileSync(resolve(import.meta.dirname, '../../../.env'), 'utf-8').split(/\r?\n/);
  } catch {
    // no .env file; environment variables must already be set
  }
  for (const line of lines) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    const key = match === null ? undefined : match[1];
    const value = match === null ? undefined : match[2]?.replace(/^['"]|['"]$/g, '');
    if (key !== undefined && value !== undefined && env[key] === undefined) env[key] = value;
  }
  return env;
}

/** Runs the human Gemini spike: env-and-argv -> one GeminiProvider call -> printed result. Never run in tests. */
function main(): void {
  const env: Record<string, string | undefined> =
    'GEMINI_API_KEY' in process.env && 'GEMINI_MODEL' in process.env
      ? process.env
      : envWithDotenv();
  const imagePath = process.argv[2];
  const kind = process.argv[3] === 'label' ? 'label' : 'dish';
  if (imagePath === undefined) {
    process.stderr.write('usage: tsx src/spike-gemini.ts <image path> [kind]\n');
    process.exitCode = 1;
    return;
  }
  const apiKey = env['GEMINI_API_KEY'];
  const model = env['GEMINI_MODEL'];
  if (apiKey === undefined || apiKey === '' || model === undefined || model === '') {
    process.stderr.write('error: GEMINI_API_KEY and GEMINI_MODEL must be set (in .env)\n');
    process.exitCode = 1;
    return;
  }
  const extension = imagePath.slice(imagePath.lastIndexOf('.')).toLowerCase();
  const mimeType = MIME_BY_EXTENSION[extension];
  if (mimeType === undefined) {
    process.stderr.write(`error: unsupported image extension ${extension}\n`);
    process.exitCode = 1;
    return;
  }
  const imageBase64 = readFileSync(imagePath).toString('base64');
  const candidate = ScanRequestSchema.safeParse({
    kind,
    imageBase64,
    mimeType,
    // neutral context: the spike measures transport latency and output shape, not safety
    context: { place: 'unknown', storage: 'unknown', hoursSinceCooked: null },
  });
  if (!candidate.success) {
    process.stderr.write(
      `error: image does not form a valid ScanRequest (${candidate.error.issues.length} issue(s), base64 length ${imageBase64.length})\n`,
    );
    process.exitCode = 1;
    return;
  }
  const started = Date.now();
  const provider = new GeminiProvider({ apiKey, model });
  provider
    .analyze(candidate.data, { dishes: [] })
    .then((result) => {
      process.stdout.write(`elapsed ms: ${Date.now() - started}\n`);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error: unknown) => {
      process.stdout.write(`elapsed ms: ${Date.now() - started}\n`);
      process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}

main();
