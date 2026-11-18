export interface ClassMetric {
  support: number;
  precision: number;
  recall: number;
  f1: number;
}

/** Returns num/den, or 0 when the denominator is 0 (never NaN). */
function ratio(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

/**
 * Returns per-class precision, recall, f1 and support over the sorted union of expected and
 * predicted labels. Precision counts a prediction of a label that is never expected as a false
 * positive with zero recall; nothing ever divides by zero.
 */
export function perClassMetrics(
  expected: readonly string[],
  predicted: readonly string[],
): Record<string, ClassMetric> {
  const labels = [...new Set([...expected, ...predicted])].sort();
  const result: Record<string, ClassMetric> = {};
  for (const label of labels) {
    const support = expected.filter((e) => e === label).length;
    const truePositives = expected.filter((e, i) => e === label && predicted[i] === label).length;
    const predictedCount = predicted.filter((p) => p === label).length;
    const precision = ratio(truePositives, predictedCount);
    const recall = ratio(truePositives, support);
    result[label] = {
      support,
      precision,
      recall,
      f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
    };
  }
  return result;
}

/** Returns the mean per-class f1, or 0 when there are no classes (never NaN). */
export function macroF1(perClass: Record<string, ClassMetric>): number {
  const values = Object.values(perClass);
  if (values.length === 0) return 0;
  return values.reduce((sum, m) => sum + m.f1, 0) / values.length;
}

/**
 * Returns a confusion matrix indexed by the sorted union of expected and predicted labels:
 * matrix[expectedIndex][predictedIndex] counts the pairs.
 */
export function confusionMatrix(
  expected: readonly string[],
  predicted: readonly string[],
): { labels: string[]; matrix: number[][] } {
  const labels = [...new Set([...expected, ...predicted])].sort();
  const indexOf = new Map(labels.map((l, i) => [l, i] as const));
  const matrix = labels.map(() => labels.map(() => 0));
  for (let i = 0; i < expected.length; i += 1) {
    const row = indexOf.get(expected[i]!);
    const col = indexOf.get(predicted[i]!);
    if (row !== undefined && col !== undefined) matrix[row]![col]! += 1;
  }
  return { labels, matrix };
}
