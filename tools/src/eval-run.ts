import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createApp } from '@sp/api/src/app';
import { GeminiProvider, MockProvider, OllamaProvider, type VisionProvider } from '@sp/ai';
import { getCatalogue } from '@sp/knowledge';
import type { AppConfig } from '@sp/api/src/config';
import {
  dishMetrics,
  labelMetrics,
  type DishPrediction,
  type EvalItem,
  type LabelPrediction,
} from './eval-lib';
import {
  asBenchmarkEntries,
  validateBenchmarkManifest,
  type BenchmarkEntry,
} from './eval-manifest';
import { confusionMatrix, macroF1, perClassMetrics, type ClassMetric } from './eval-metrics';

const DEFAULT_MAX_CALLS = 25;
const MAX_CLASS_TABLE_ROWS = 25;
const MAX_CONFUSION_LABELS = 12;
const UNKNOWN_SENTINEL = 'unknown';

/** Arguments of the eval runner: mode, how many calls to spend, which manifest and dataset. */
export interface EvalArgs {
  maxCalls: number;
  holdout: boolean;
  mode: 'api' | 'local';
  /** Benchmark manifest path (new Phase 3 format); dish recognition runs only when given. */
  manifest: string | null;
  /** Dataset root that the benchmark manifest's imagePath entries are relative to. */
  dataset: string | null;
  /** Minimum milliseconds between provider calls; keeps free-tier rate limits. */
  paceMs: number;
}

/** Metrics and latency summaries that go into the report text. */
export interface ReportMetrics {
  dishes: { n: number; top1: number; top3: number; unknownRate: number };
  labels: { n: number; allergenPrecision: number; allergenRecall: number; expiryExact: number };
  poorImageQualityShare: number;
  medianLatencyMs: number;
}

/** Dish-recognition benchmark results from the Phase 3 manifest format. */
export interface DishBenchmark {
  source: string;
  licence: string;
  entriesTotal: number;
  evaluated: number;
  unmapped: number;
  unusedDuplicates: number;
  top1: number;
  top3: number;
  unknownRate: number;
  macroF1: number;
  perClass: Record<string, ClassMetric>;
  confusion: { labels: string[]; matrix: number[][] } | null;
}

/** One failed item in the report: what was expected and what the API returned. */
export interface ReportFailure {
  file: string;
  expected: string;
  got: string;
}

/** Parses the CLI arguments; throws on anything unknown or invalid. */
export function parseArgs(argv: string[]): EvalArgs {
  const args: EvalArgs = {
    maxCalls: DEFAULT_MAX_CALLS,
    holdout: false,
    mode: 'api',
    manifest: null,
    dataset: null,
    paceMs: 0,
  };
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
    } else if (arg === '--mode') {
      const value = argv[i + 1];
      if (value !== 'api' && value !== 'local') {
        throw new Error('--mode must be "api" or "local"');
      }
      args.mode = value;
      i += 1;
    } else if (arg === '--manifest') {
      const value = argv[i + 1];
      if (value === undefined || value === '') throw new Error('--manifest needs a value');
      args.manifest = value;
      i += 1;
    } else if (arg === '--dataset') {
      const value = argv[i + 1];
      if (value === undefined || value === '') throw new Error('--dataset needs a value');
      args.dataset = value;
      i += 1;
    } else if (arg === '--pace-ms') {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error('--pace-ms must be a non-negative integer');
      }
      args.paceMs = value;
      i += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return args;
}

/** Returns the vision provider named by EVAL_PROVIDER; never defaults to mock. */
export function localProviderFromEnv(env: Record<string, string | undefined>): VisionProvider {
  const name = env['EVAL_PROVIDER'];
  if (name === 'mock') return new MockProvider();
  if (name === 'ollama') {
    const model = env['EVAL_MODEL'];
    if (model === undefined || model === '') {
      throw new Error('EVAL_PROVIDER=ollama needs EVAL_MODEL (the local Ollama model name)');
    }
    return new OllamaProvider({ model, baseUrl: env['EVAL_OLLAMA_BASE_URL'] });
  }
  if (name === 'gemini') {
    const apiKey = env['GEMINI_API_KEY'];
    const model = env['GEMINI_MODEL'];
    if (apiKey === undefined || apiKey === '' || model === undefined || model === '') {
      throw new Error('EVAL_PROVIDER=gemini needs GEMINI_API_KEY and GEMINI_MODEL');
    }
    return new GeminiProvider({ apiKey, model });
  }
  throw new Error('EVAL_PROVIDER must be set explicitly to "mock" or "gemini"');
}

/** Formats a rate 0..1 as a percentage with one decimal; a non-finite rate renders as n/a. */
function pct(rate: number): string {
  return Number.isFinite(rate) ? `${(rate * 100).toFixed(1)}%` : 'n/a';
}

/** Renders the markdown report body; never prints NaN, whatever the metrics contain. */
export function renderReport(
  metrics: ReportMetrics,
  failures: ReportFailure[],
  benchmark?: DishBenchmark,
): string {
  const lines: string[] = [];
  if (benchmark !== undefined) {
    lines.push(
      '## Dataset',
      '',
      `- source: ${benchmark.source}`,
      `- licence: ${benchmark.licence}`,
      `- images in manifest: ${benchmark.entriesTotal} ` +
        `(${benchmark.evaluated} evaluated, ${benchmark.unmapped} unmapped to the catalogue, ` +
        `${benchmark.unusedDuplicates} exact duplicates marked unused)`,
      '- class imbalance and support are shown per class below; unmapped labels are never scored.',
      '',
      '## Dish recognition (benchmark)',
      '',
      `- evaluated dishes: ${benchmark.evaluated}`,
      `- top-1 accuracy: ${pct(benchmark.top1)}`,
      `- top-3 accuracy: ${pct(benchmark.top3)}`,
      `- unknown rate: ${pct(benchmark.unknownRate)}`,
      `- macro-F1: ${Number.isFinite(benchmark.macroF1) ? benchmark.macroF1.toFixed(3) : 'n/a'}`,
      '',
    );
    const classRows = Object.entries(benchmark.perClass).slice(0, MAX_CLASS_TABLE_ROWS);
    if (classRows.length > 0) {
      lines.push('### Per-class precision / recall (support shown)', '');
      lines.push('| class | support | precision | recall | f1 |');
      lines.push('| --- | --- | --- | --- | --- |');
      for (const [label, m] of classRows) {
        lines.push(
          `| ${label} | ${m.support} | ${Number.isFinite(m.precision) ? m.precision.toFixed(2) : 'n/a'} | ${
            Number.isFinite(m.recall) ? m.recall.toFixed(2) : 'n/a'
          } | ${Number.isFinite(m.f1) ? m.f1.toFixed(2) : 'n/a'} |`,
        );
      }
      lines.push('');
    }
    if (benchmark.confusion !== null && benchmark.confusion.labels.length <= MAX_CONFUSION_LABELS) {
      lines.push('### Confusion matrix (rows = expected, columns = predicted)', '');
      lines.push(`| ${['', ...benchmark.confusion.labels].join(' | ')} |`);
      lines.push(`| ${benchmark.confusion.labels.map(() => '---').join(' | ')} |`);
      for (let r = 0; r < benchmark.confusion.labels.length; r += 1) {
        const row = benchmark.confusion.labels.map((l, c) =>
          c === r
            ? `**${benchmark.confusion!.matrix[r]![c]!}**`
            : String(benchmark.confusion!.matrix[r]![c]!),
        );
        lines.push(`| ${benchmark.confusion.labels[r]!} | ${row.join(' | ')} |`);
      }
      lines.push('');
    }
  }
  lines.push(
    '## Dish recognition (legacy manifest)',
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
  );
  if (failures.length === 0) {
    lines.push('- none');
  } else {
    for (const f of failures.slice(0, 50)) {
      lines.push(`- ${f.file} — expected: ${f.expected}, got: ${f.got}`);
    }
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

type Poster = (body: string) => Promise<{ status: number; text: string }>;

interface ScanOutcome {
  prediction: DishPrediction | LabelPrediction | null;
  imageQualityPoor: boolean | null;
  latencyMs: number;
  got: string;
}

async function scanOne(
  poster: Poster,
  file: string,
  kind: 'dish' | 'label',
  photoDir: string,
): Promise<ScanOutcome> {
  const mime = mimeTypeFor(file);
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
    bytes = readFileSync(path.join(photoDir, file));
  } catch {
    return { prediction: null, imageQualityPoor: null, latencyMs: 0, got: 'photo file missing' };
  }
  const body = JSON.stringify({
    kind,
    imageBase64: bytes.toString('base64'),
    mimeType: mime,
    context: {
      place: kind === 'label' ? 'packaged' : 'home',
      storage: 'unknown',
      hoursSinceCooked: null,
    },
  });
  const started = Date.now();
  let parsed: unknown;
  try {
    const res = await poster(body);
    const latencyMs = Date.now() - started;
    try {
      parsed = JSON.parse(res.text);
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
    const responseKind = asRecord['kind'];
    if (responseKind === 'dish') {
      const candidates = (asRecord['candidates'] as Array<{ dishId: string | null }>) ?? [];
      const quality = (asRecord['observations'] as { imageQuality?: string } | undefined)?.[
        'imageQuality'
      ];
      return {
        prediction: { file, candidates },
        imageQualityPoor: quality === 'poor',
        latencyMs,
        got: candidates[0]?.dishId ?? 'unknown',
      };
    }
    if (responseKind === 'label') {
      const quality = (asRecord['observations'] as { imageQuality?: string } | undefined)?.[
        'imageQuality'
      ];
      return {
        prediction: {
          file,
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

interface BenchmarkOutcome {
  benchmark: DishBenchmark;
  failures: ReportFailure[];
  latencies: number[];
  poorShare: { counted: number; poor: number };
}

/**
 * Runs the dish-recognition benchmark from the Phase 3 manifest against a poster.
 * Images whose dataset label is unmapped or that are marked unused are never scored.
 */
async function runBenchmark(
  entries: BenchmarkEntry[],
  datasetRoot: string,
  poster: Poster,
  maxCalls: number,
  paceMs: number,
): Promise<BenchmarkOutcome> {
  const scorable = entries.filter((e) => e.kind === 'dish' && e.mappedDishId !== null);
  const split = 'dev';
  const selected = scorable.filter((e) => e.split === split).slice(0, maxCalls);
  const expected: string[] = [];
  const predicted: string[] = [];
  const failures: ReportFailure[] = [];
  const latencies: number[] = [];
  let poor = 0;
  let counted = 0;
  let top1 = 0;
  let top3 = 0;
  let unknown = 0;
  for (const entry of selected) {
    if (paceMs > 0) await new Promise((resolve) => setTimeout(resolve, paceMs));
    const outcome = await scanOne(poster, entry.imagePath, 'dish', datasetRoot);
    if (outcome.latencyMs > 0) latencies.push(outcome.latencyMs);
    if (outcome.imageQualityPoor !== null) {
      counted += 1;
      if (outcome.imageQualityPoor) poor += 1;
    }
    const dishPred = outcome.prediction as DishPrediction | null;
    expected.push(entry.mappedDishId!);
    const first = dishPred?.candidates[0];
    if (first === undefined) {
      predicted.push(UNKNOWN_SENTINEL);
    } else if (first.dishId === null) {
      unknown += 1;
      predicted.push(UNKNOWN_SENTINEL);
    } else {
      predicted.push(first.dishId);
    }
    const hitTop3 = dishPred?.candidates
      .slice(0, 3)
      .some((c) => c.dishId !== null && c.dishId === entry.mappedDishId);
    if (first !== undefined && first.dishId === entry.mappedDishId) top1 += 1;
    if (hitTop3 === true) top3 += 1;
    failures.push({
      file: entry.imagePath,
      expected: entry.mappedDishId!,
      got: outcome.got,
    });
  }
  const failuresOnly = failures.filter((f) => f.expected !== f.got);
  const n = expected.length;
  const perClass = perClassMetrics(expected, predicted);
  const confusion = confusionMatrix(expected, predicted);
  return {
    benchmark: {
      source: selected[0]?.source ?? entries[0]?.source ?? 'unknown',
      licence: selected[0]?.licence ?? entries[0]?.licence ?? 'unknown',
      entriesTotal: entries.length,
      evaluated: n,
      unmapped: entries.filter((e) => e.kind === 'dish' && e.mappedDishId === null).length,
      unusedDuplicates: entries.filter((e) => e.split === 'unused').length,
      top1: n === 0 ? 0 : top1 / n,
      top3: n === 0 ? 0 : top3 / n,
      unknownRate: n === 0 ? 0 : unknown / n,
      macroF1: macroF1(perClass),
      perClass,
      confusion,
    },
    failures: failuresOnly,
    latencies,
    poorShare: { counted, poor },
  };
}

function loadLegacyItems(evalDir: string): EvalItem[] {
  const manifestPath = path.join(evalDir, 'manifest.json');
  if (!existsSync(manifestPath)) return [];
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as EvalItem[];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const evalDir = fileURLToPath(new URL('../../eval', import.meta.url));
  let poster: Poster;
  let target: string;
  if (args.mode === 'local') {
    // Local harness: the same app code the API deploys, in-process, no endpoint needed.
    const config: AppConfig = {
      allowedOrigin: 'http://eval.local',
      maxBodyBytes: 20_000_000,
      provider: localProviderFromEnv(process.env),
      catalogue: getCatalogue().entries.map((entry) => ({
        id: entry.id,
        name_en: entry.name_en,
        name_bn: entry.name_bn,
        aliases: entry.aliases,
        category: entry.category,
      })),
    };
    const app = createApp(config);
    target = `local app (provider: ${config.provider?.name ?? 'none'})`;
    poster = async (body) => {
      const res = await app.request('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      return { status: res.status, text: await res.text() };
    };
  } else {
    target = process.env['API_URL'] ?? '';
    if (target === '') {
      process.stderr.write(
        'eval-run: API mode needs API_URL, or use --mode local for the in-process harness\n',
      );
      process.exitCode = 1;
      return;
    }
    const base = target.replace(/\/+$/, '');
    poster = async (body) => {
      const res = await fetch(`${base}/api/scan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      return { status: res.status, text: await res.text() };
    };
  }

  let benchmarkOutcome: BenchmarkOutcome | null = null;
  if (args.manifest !== null) {
    const manifestValue: unknown = JSON.parse(readFileSync(args.manifest, 'utf8'));
    const problems = validateBenchmarkManifest(manifestValue);
    if (problems.length > 0) {
      process.stderr.write(`eval-run: benchmark manifest is invalid:\n${problems.join('\n')}\n`);
      process.exitCode = 1;
      return;
    }
    if (args.dataset === null) {
      process.stderr.write('eval-run: --dataset is required with --manifest\n');
      process.exitCode = 1;
      return;
    }
    benchmarkOutcome = await runBenchmark(
      asBenchmarkEntries(manifestValue),
      args.dataset,
      poster,
      args.maxCalls,
      args.paceMs,
    );
  }

  const items = loadLegacyItems(evalDir);
  const split = args.holdout ? 'holdout' : 'dev';
  const selected = items.filter((i) => i.split === split).slice(0, args.maxCalls);
  const capped = items.filter((i) => i.split === split).length > selected.length;
  process.stdout.write(
    `eval-run: ${target}${capped ? ` (capped at --max-calls ${args.maxCalls})` : ''}\n`,
  );

  const dishPreds: DishPrediction[] = [];
  const labelPreds: LabelPrediction[] = [];
  const failures: ReportFailure[] = benchmarkOutcome === null ? [] : [...benchmarkOutcome.failures];
  const latencies: number[] = benchmarkOutcome === null ? [] : [...benchmarkOutcome.latencies];
  let poorCount = benchmarkOutcome?.poorShare.poor ?? 0;
  let responseCount = benchmarkOutcome?.poorShare.counted ?? 0;
  for (const item of selected) {
    const outcome = await scanOne(poster, item.file, item.kind, path.join(evalDir, 'photos'));
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
    `- target: ${target}`,
    `- mode: ${args.mode}, split: ${split}${capped ? ` (stopped after ${selected.length} calls, --max-calls ${args.maxCalls})` : ''}`,
    '- generated by `pnpm --filter @sp/tools eval-run`',
    '',
  ].join('\n');
  const report = renderReport(metrics, failures, benchmarkOutcome?.benchmark);
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
