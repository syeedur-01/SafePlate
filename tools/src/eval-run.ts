import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  dishMetrics,
  labelMetrics,
  type DishPrediction,
  type EvalItem,
  type LabelPrediction,
} from './eval-lib';

const DEFAULT_MAX_CALLS = 25;

/** Arguments of the eval runner: how many API calls to spend and which split to run. */
export interface EvalArgs {
  maxCalls: number;
  holdout: boolean;
}

/** Metrics and latency summaries that go into the report text. */
export interface ReportMetrics {
  dishes: { n: number; top1: number; top3: number; unknownRate: number };
  labels: { n: number; allergenPrecision: number; allergenRecall: number; expiryExact: number };
  poorImageQualityShare: number;
  medianLatencyMs: number;
}

/** One failed item in the report: what was expected and what the API returned. */
export interface ReportFailure {
  file: string;
  expected: string;
  got: string;
}

/** Parses the CLI arguments; throws on anything unknown or invalid. */
export function parseArgs(argv: string[]): EvalArgs {
  const args: EvalArgs = { maxCalls: DEFAULT_MAX_CALLS, holdout: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--max-calls') {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--max-calls must be a positive integer');
      }
      args.maxCalls = value;
      i += 1;
    } else if (arg === '--holdout') {
      args.holdout = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return args;
}

/** Formats a rate 0..1 as a percentage with one decimal; a non-finite rate renders as n/a. */
function pct(rate: number): string {
  return Number.isFinite(rate) ? `${(rate * 100).toFixed(1)}%` : 'n/a';
}

/** Renders the markdown report body; never prints NaN, whatever the metrics contain. */
export function renderReport(metrics: ReportMetrics, failures: ReportFailure[]): string {
  const lines: string[] = [
    '## Dish recognition',
    '',
    `- evaluated dishes: ${metrics.dishes.n}`,
    `- top-1 accuracy: ${pct(metrics.dishes.top1)}`,
    `- top-3 accuracy: ${pct(metrics.dishes.top3)}`,
    `- unknown rate: ${pct(metrics.dishes.unknownRate)}`,
    '',
    '## Label reading',
    '',
    `- evaluated labels: ${metrics.labels.n}`,
    `- allergen precision: ${pct(metrics.labels.allergenPrecision)}`,
    `- allergen recall: ${pct(metrics.labels.allergenRecall)}`,
    `- expiry exact match: ${pct(metrics.labels.expiryExact)}`,
    '',
    '## Robustness',
    '',
    `- responses with imageQuality "poor": ${pct(metrics.poorImageQualityShare)}`,
    `- median latency: ${Number.isFinite(metrics.medianLatencyMs) ? metrics.medianLatencyMs.toFixed(0) : 'n/a'} ms`,
    '',
    '## Failures',
    '',
  ];
  if (failures.length === 0) {
    lines.push('- none');
  } else {
    for (const f of failures) lines.push(`- ${f.file} — expected: ${f.expected}, got: ${f.got}`);
  }
  return lines.join('\n');
}

function mimeTypeFor(file: string): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  const lower = file.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

interface ScanOutcome {
  prediction: DishPrediction | LabelPrediction | null;
  imageQualityPoor: boolean | null;
  latencyMs: number;
  got: string;
}

async function scanOne(apiUrl: string, item: EvalItem, photoDir: string): Promise<ScanOutcome> {
  const mime = mimeTypeFor(item.file);
  if (mime === null) {
    return {
      prediction: null,
      imageQualityPoor: null,
      latencyMs: 0,
      got: 'unsupported file extension',
    };
  }
  let bytes: Buffer;
  try {
    bytes = readFileSync(path.join(photoDir, item.file));
  } catch {
    return {
      prediction: null,
      imageQualityPoor: null,
      latencyMs: 0,
      got: 'photo file missing in eval/photos/',
    };
  }
  const body = JSON.stringify({
    kind: item.kind,
    imageBase64: bytes.toString('base64'),
    mimeType: mime,
    context: {
      place: item.kind === 'label' ? 'packaged' : 'home',
      storage: 'unknown',
      hoursSinceCooked: null,
    },
  });
  const started = Date.now();
  let parsed: unknown;
  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    const latencyMs = Date.now() - started;
    const text = await res.text();
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        prediction: null,
        imageQualityPoor: null,
        latencyMs,
        got: `status ${res.status}, non-JSON body`,
      };
    }
    const asRecord = parsed as Record<string, unknown>;
    if (res.status !== 200) {
      const code = (asRecord['error'] as { code?: unknown } | undefined)?.['code'];
      return {
        prediction: null,
        imageQualityPoor: null,
        latencyMs,
        got: `API error ${typeof code === 'string' ? code : res.status}`,
      };
    }
    const kind = asRecord['kind'];
    if (kind === 'dish') {
      const candidates = (asRecord['candidates'] as Array<{ dishId: string | null }>) ?? [];
      const quality = (asRecord['observations'] as { imageQuality?: string } | undefined)?.[
        'imageQuality'
      ];
      return {
        prediction: { file: item.file, candidates },
        imageQualityPoor: quality === 'poor',
        latencyMs,
        got: candidates[0]?.dishId ?? 'unknown',
      };
    }
    if (kind === 'label') {
      const quality = (asRecord['observations'] as { imageQuality?: string } | undefined)?.[
        'imageQuality'
      ];
      return {
        prediction: {
          file: item.file,
          declaredAllergens: (asRecord['declaredAllergens'] as EvalLabelPredictionAllergens) ?? [],
          expiryDate: (asRecord['expiryDate'] as string | null) ?? null,
        },
        imageQualityPoor: quality === 'poor',
        latencyMs,
        got: `allergens=[${((asRecord['declaredAllergens'] as unknown[]) ?? []).join(',')}] expiry=${String(asRecord['expiryDate'])}`,
      };
    }
    return { prediction: null, imageQualityPoor: null, latencyMs, got: 'unexpected response kind' };
  } catch (error) {
    return {
      prediction: null,
      imageQualityPoor: null,
      latencyMs: Date.now() - started,
      got: `request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

type EvalLabelPredictionAllergens = LabelPrediction['declaredAllergens'];

function expectedOf(item: EvalItem): string {
  if (item.kind === 'dish') return item.expectedDishId ?? 'not on the dish list';
  const allergens = (item.expectedAllergens ?? []).join(',');
  return `allergens=[${allergens}] expiry=${item.expectedExpiry ?? 'none'}`;
}

/** Returns true when the item's prediction matches what the manifest expects. */
function isHit(item: EvalItem, prediction: DishPrediction | LabelPrediction | null): boolean {
  if (item.kind === 'dish') {
    if (typeof item.expectedDishId !== 'string' || item.expectedDishId === '') return true; // not evaluated
    const first = (prediction as DishPrediction | null)?.candidates[0];
    return first !== undefined && first.dishId === item.expectedDishId;
  }
  const labelPred = prediction as LabelPrediction | null;
  if (!labelPred) return false;
  const expected = new Set(item.expectedAllergens ?? []);
  const got = new Set(labelPred.declaredAllergens);
  for (const a of expected) if (!got.has(a)) return false;
  return labelPred.expiryDate === (item.expectedExpiry ?? null);
}

async function main(): Promise<void> {
  const apiUrl = process.env['API_URL'] ?? '';
  if (apiUrl === '') {
    process.stderr.write(
      'eval-run: set API_URL to the deployed worker URL (example: https://safeplate-api.<subdomain>.workers.dev)\n',
    );
    process.exitCode = 1;
    return;
  }
  const args = parseArgs(process.argv.slice(2));
  const evalDir = fileURLToPath(new URL('../../eval', import.meta.url));
  let items: EvalItem[];
  try {
    items = JSON.parse(readFileSync(path.join(evalDir, 'manifest.json'), 'utf8')) as EvalItem[];
  } catch {
    process.stderr.write(
      'eval-run: eval/manifest.json not found or not JSON (see eval/README.md)\n',
    );
    process.exitCode = 1;
    return;
  }
  const split = args.holdout ? 'holdout' : 'dev';
  const selected = items.filter((i) => i.split === split).slice(0, args.maxCalls);
  const capped = items.filter((i) => i.split === split).length > selected.length;
  process.stdout.write(
    `eval-run: ${selected.length} ${split} item(s) against ${apiUrl}${capped ? ` (capped at --max-calls ${args.maxCalls})` : ''}\n`,
  );

  const dishPreds: DishPrediction[] = [];
  const labelPreds: LabelPrediction[] = [];
  const failures: ReportFailure[] = [];
  const latencies: number[] = [];
  let poorCount = 0;
  let responseCount = 0;
  for (const item of selected) {
    const outcome = await scanOne(apiUrl, item, path.join(evalDir, 'photos'));
    if (outcome.latencyMs > 0) latencies.push(outcome.latencyMs);
    if (outcome.imageQualityPoor !== null) {
      responseCount += 1;
      if (outcome.imageQualityPoor) poorCount += 1;
    }
    if (outcome.prediction !== null) {
      if (item.kind === 'dish') dishPreds.push(outcome.prediction as DishPrediction);
      else labelPreds.push(outcome.prediction as LabelPrediction);
    }
    if (!isHit(item, outcome.prediction)) {
      failures.push({ file: item.file, expected: expectedOf(item), got: outcome.got });
    }
  }

  const metrics: ReportMetrics = {
    dishes: dishMetrics(selected, dishPreds),
    labels: labelMetrics(selected, labelPreds),
    poorImageQualityShare: responseCount === 0 ? 0 : poorCount / responseCount,
    medianLatencyMs: median(latencies),
  };
  const meta = [
    '# Vision evaluation report',
    '',
    `- API: ${apiUrl}`,
    `- split: ${split}${capped ? ` (stopped after ${selected.length} calls, --max-calls ${args.maxCalls})` : ''}`,
    '- generated by `pnpm --filter @sp/tools eval-run` (P3-X05); see eval/README.md',
    '',
  ].join('\n');
  const report = renderReport(metrics, failures);
  const outPath = fileURLToPath(new URL('../../docs/EVAL_REPORT.md', import.meta.url));
  writeFileSync(outPath, `${meta}${report}\n`);
  process.stdout.write(`${report}\n`);
  process.stdout.write(`report written to docs/EVAL_REPORT.md\n`);
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  await main();
}

export {};
