export interface SizeEntry {
  file: string;
  gzipBytes: number;
}

/** Sums gzip sizes (bytes) of files and returns a printable table plus the total. */
export function summarizeSizes(entries: Array<{ file: string; gzipBytes: number }>): {
  total: number;
  lines: string[];
} {
  let total = 0;
  const lines: string[] = [];
  for (const entry of entries) {
    total += entry.gzipBytes;
    lines.push(`${entry.file}  ${entry.gzipBytes} B gzip`);
  }
  return { total, lines };
}

/** Returns true if total is within budget. */
export function withinBudget(total: number, budget: number): boolean {
  return total <= budget;
}
