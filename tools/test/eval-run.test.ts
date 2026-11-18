import { describe, it, expect } from 'vitest';
import {
  localProviderFromEnv,
  parseArgs,
  renderReport,
  type DishBenchmark,
  type ReportMetrics,
} from '../src/eval-run';

const metrics = (): ReportMetrics => ({
  dishes: { n: 10, top1: 0.7, top3: 0.9, unknownRate: 0.1 },
  labels: { n: 5, allergenPrecision: 0.8, allergenRecall: 0.75, expiryExact: 0.6 },
  poorImageQualityShare: 0.125,
  medianLatencyMs: 1234,
});

const benchmark = (): DishBenchmark => ({
  source: 'BD-Food33 v1 (DOI 10.17632/8wt48bjmx3.1)',
  licence: 'CC0-1.0',
  entriesTotal: 1200,
  evaluated: 10,
  unmapped: 500,
  unusedDuplicates: 30,
  top1: 0.7,
  top3: 0.9,
  unknownRate: 0.1,
  macroF1: 0.5,
  perClass: { 'kacchi-biryani': { support: 4, precision: 1, recall: 0.75, f1: 0.857 } },
  confusion: {
    labels: ['a', 'b'],
    matrix: [
      [3, 1],
      [0, 6],
    ],
  },
});

describe('renderReport', () => {
  it('contains the required headings', () => {
    const report = renderReport(metrics(), []);
    expect(report).toContain('Dish recognition');
    expect(report).toContain('Label reading');
    expect(report).toContain('Failures');
  });

  it('includes the dataset statement, macro-F1 and per-class table when a benchmark ran', () => {
    const report = renderReport(metrics(), [], benchmark());
    expect(report).toContain('CC0-1.0');
    expect(report).toContain('unmapped to the catalogue');
    expect(report).toContain('macro-F1');
    expect(report).toContain('kacchi-biryani');
    expect(report).toContain('Confusion matrix');
  });

  it('never prints NaN in the benchmark section', () => {
    const b = benchmark();
    b.macroF1 = Number.NaN;
    const report = renderReport(metrics(), [], b);
    expect(report.includes('NaN')).toBe(false);
  });

  it('formats rates as percentages with one decimal', () => {
    const report = renderReport(metrics(), []);
    expect(report).toContain('70.0%');
    expect(report).toContain('90.0%');
    expect(report).toContain('12.5%');
  });

  it('never prints NaN', () => {
    const m = metrics();
    m.dishes.top1 = Number.NaN;
    m.labels.expiryExact = Number.NaN;
    m.medianLatencyMs = Number.NaN;
    const report = renderReport(m, []);
    expect(report.includes('NaN')).toBe(false);
  });

  it('lists failures with file, expected and got', () => {
    const report = renderReport(metrics(), [
      { file: 'kacchi-01.jpg', expected: 'kacchi-biryani', got: 'unknown' },
    ]);
    expect(report).toContain('kacchi-01.jpg');
    expect(report).toContain('kacchi-biryani');
    expect(report).toContain('unknown');
  });
});

describe('parseArgs', () => {
  it('reads --max-calls', () => {
    expect(parseArgs(['--max-calls', '5'])).toEqual({
      maxCalls: 5,
      holdout: false,
      mode: 'api',
      manifest: null,
      dataset: null,
      paceMs: 0,
    });
  });

  it('defaults to 25 calls, the dev split and api mode', () => {
    expect(parseArgs([])).toEqual({
      maxCalls: 25,
      holdout: false,
      mode: 'api',
      manifest: null,
      dataset: null,
      paceMs: 0,
    });
  });

  it('reads --mode, --manifest and --dataset', () => {
    expect(parseArgs(['--mode', 'local', '--manifest', 'm.json', '--dataset', 'd'])).toEqual({
      maxCalls: 25,
      holdout: false,
      mode: 'local',
      manifest: 'm.json',
      dataset: 'd',
      paceMs: 0,
    });
  });

  it('reads --pace-ms and rejects a negative value', () => {
    expect(parseArgs(['--pace-ms', '4000']).paceMs).toBe(4000);
    expect(() => parseArgs(['--pace-ms', '-1'])).toThrow();
  });

  it('rejects an unknown mode', () => {
    expect(() => parseArgs(['--mode', 'remote'])).toThrow();
  });

  it('runs the holdout once with --holdout', () => {
    expect(parseArgs(['--holdout']).holdout).toBe(true);
  });

  it('rejects a non-positive max-calls value', () => {
    expect(() => parseArgs(['--max-calls', '0'])).toThrow();
    expect(() => parseArgs(['--max-calls', 'abc'])).toThrow();
  });

  it('rejects unknown arguments', () => {
    expect(() => parseArgs(['--tune'])).toThrow();
  });
});

describe('localProviderFromEnv', () => {
  it('returns the mock provider when EVAL_PROVIDER=mock', () => {
    expect(localProviderFromEnv({ EVAL_PROVIDER: 'mock' }).name).toBe('mock');
  });

  it('returns the gemini provider only with a key and model', () => {
    const provider = localProviderFromEnv({
      EVAL_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'K',
      GEMINI_MODEL: 'm',
    });
    expect(provider.name).toBe('gemini');
    expect(() => localProviderFromEnv({ EVAL_PROVIDER: 'gemini', GEMINI_API_KEY: 'K' })).toThrow(
      'GEMINI_MODEL',
    );
  });

  it('returns the ollama provider only with a model name', () => {
    const provider = localProviderFromEnv({ EVAL_PROVIDER: 'ollama', EVAL_MODEL: 'm' });
    expect(provider.name).toBe('ollama');
    expect(() => localProviderFromEnv({ EVAL_PROVIDER: 'ollama' })).toThrow('EVAL_MODEL');
  });

  it('refuses to default: an unset EVAL_PROVIDER throws', () => {
    expect(() => localProviderFromEnv({})).toThrow('EVAL_PROVIDER');
  });
});
