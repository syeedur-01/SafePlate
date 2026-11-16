import { describe, it, expect } from 'vitest';
import { renderReport, parseArgs, type ReportMetrics } from '../src/eval-run';

const metrics = (): ReportMetrics => ({
  dishes: { n: 10, top1: 0.7, top3: 0.9, unknownRate: 0.1 },
  labels: { n: 5, allergenPrecision: 0.8, allergenRecall: 0.75, expiryExact: 0.6 },
  poorImageQualityShare: 0.125,
  medianLatencyMs: 1234,
});

describe('renderReport', () => {
  it('contains the required headings', () => {
    const report = renderReport(metrics(), []);
    expect(report).toContain('Dish recognition');
    expect(report).toContain('Label reading');
    expect(report).toContain('Failures');
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
    expect(parseArgs(['--max-calls', '5'])).toEqual({ maxCalls: 5, holdout: false });
  });

  it('defaults to 25 calls and the dev split', () => {
    expect(parseArgs([])).toEqual({ maxCalls: 25, holdout: false });
  });

  it('runs the holdout once with --holdout', () => {
    expect(parseArgs(['--holdout'])).toEqual({ maxCalls: 25, holdout: true });
  });

  it('rejects a non-positive max-calls value', () => {
    expect(() => parseArgs(['--max-calls', '0'])).toThrow();
    expect(() => parseArgs(['--max-calls', 'abc'])).toThrow();
  });

  it('rejects unknown arguments', () => {
    expect(() => parseArgs(['--tune'])).toThrow();
  });
});
