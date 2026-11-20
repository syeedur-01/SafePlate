export const BENCHMARK_KINDS = ['dish', 'label', 'spoilage'] as const;
export const BENCHMARK_SPLITS = ['dev', 'holdout', 'unused'] as const;

export type BenchmarkKind = (typeof BENCHMARK_KINDS)[number];
export type BenchmarkSplit = (typeof BENCHMARK_SPLITS)[number];

/** One benchmark image: licence-cleared metadata only, never image bytes. */
export interface BenchmarkEntry {
  imageId: string;
  /** Path relative to the dataset root; must not escape it. */
  imagePath: string;
  kind: BenchmarkKind;
  /** The dataset's own label (folder name); mapping to the catalogue is separate. */
  datasetLabel: string;
  split: BenchmarkSplit;
  source: string;
  licence: string;
  attribution: string | null;
  /** SafePlate catalogue dish id, or null while unmapped (unmapped images are not evaluated). */
  mappedDishId: string | null;
  notes: string | null;
}

/** One row of the human-reviewable dataset-label to catalogue mapping. */
export interface LabelMapEntry {
  datasetLabel: string;
  safePlateDishId: string | null;
  status: 'proposed' | 'approved';
  reason: string | null;
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isOptionalString = (v: unknown): boolean => v === null || v === undefined || isString(v);

function fieldProblems(entry: Record<string, unknown>): string[] {
  const problems: string[] = [];
  if (!isString(entry['imageId']) || entry['imageId'] === '') {
    problems.push('imageId must be a non-empty string');
  }
  if (!isString(entry['imagePath'])) {
    problems.push('imagePath must be a string');
  } else {
    const p = entry['imagePath'];
    if (
      p.startsWith('/') ||
      p.includes('..') ||
      p.includes('\\') ||
      p.includes('\0') ||
      p.trim() !== p ||
      p === ''
    ) {
      problems.push(`imagePath must be a relative path inside the dataset: ${p}`);
    }
  }
  if (!BENCHMARK_KINDS.includes(entry['kind'] as BenchmarkKind)) {
    problems.push(`kind must be one of ${BENCHMARK_KINDS.join(', ')}`);
  }
  if (!isString(entry['datasetLabel']) || entry['datasetLabel'] === '') {
    problems.push('datasetLabel must be a non-empty string');
  }
  if (!BENCHMARK_SPLITS.includes(entry['split'] as BenchmarkSplit)) {
    problems.push(`split must be one of ${BENCHMARK_SPLITS.join(', ')}`);
  }
  if (!isString(entry['source']) || entry['source'] === '') {
    problems.push('source must be a non-empty string (dataset name + DOI/URL)');
  }
  if (!isString(entry['licence']) || entry['licence'] === '') {
    problems.push('licence must be a non-empty string (e.g. CC0-1.0)');
  }
  if (!isOptionalString(entry['attribution'])) {
    problems.push('attribution must be a string or null');
  }
  if (!(
    entry['mappedDishId'] === null ||
    (isString(entry['mappedDishId']) && entry['mappedDishId'] !== '')
  )) {
    problems.push('mappedDishId must be a non-empty string or null');
  }
  if (!isOptionalString(entry['notes'])) {
    problems.push('notes must be a string or null');
  }
  return problems;
}

/** Returns every validation problem in a benchmark manifest; an empty list means valid. */
export function validateBenchmarkManifest(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ['manifest must be a non-empty array of entries'];
  }
  const problems: string[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < value.length; i += 1) {
    const entry = value[i];
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push(`entry ${i}: must be an object`);
      continue;
    }
    for (const p of fieldProblems(entry as Record<string, unknown>)) {
      problems.push(`entry ${i}: ${p}`);
    }
    const id = (entry as Record<string, unknown>)['imageId'];
    if (isString(id)) {
      if (seenIds.has(id)) problems.push(`entry ${i}: duplicate imageId ${id}`);
      seenIds.add(id);
    }
  }
  return problems;
}

const DISH_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Returns every validation problem in a label map; an empty list means valid. */
export function validateLabelMap(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ['label map must be a non-empty array of entries'];
  }
  const problems: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < value.length; i += 1) {
    const entry = value[i];
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push(`entry ${i}: must be an object`);
      continue;
    }
    const e = entry as Record<string, unknown>;
    if (!isString(e['datasetLabel']) || e['datasetLabel'] === '') {
      problems.push(`entry ${i}: datasetLabel must be a non-empty string`);
      continue;
    }
    if (seen.has(e['datasetLabel'])) {
      problems.push(`entry ${i}: duplicate datasetLabel ${e['datasetLabel']}`);
    }
    seen.add(e['datasetLabel']);
    const id = e['safePlateDishId'];
    const mapped = id !== null && id !== undefined;
    if (id === undefined || !(id === null || (isString(id) && id !== ''))) {
      problems.push(`entry ${i}: safePlateDishId must be a non-empty string or null`);
    } else if (mapped && isString(id) && !DISH_ID_PATTERN.test(id)) {
      problems.push(`entry ${i}: safePlateDishId must be a lowercase slug: ${String(id)}`);
    }
    if (e['status'] !== 'proposed' && e['status'] !== 'approved') {
      problems.push(`entry ${i}: status must be "proposed" or "approved"`);
    }
    if (e['status'] === 'approved' && !mapped) {
      problems.push(`entry ${i}: an unmapped label cannot be approved`);
    }
    if (!isOptionalString(e['reason'])) {
      problems.push(`entry ${i}: reason must be a string or null`);
    }
  }
  return problems;
}

/** Narrows a validated manifest; the caller must run validateBenchmarkManifest first. */
export function asBenchmarkEntries(value: unknown): BenchmarkEntry[] {
  return value as BenchmarkEntry[];
}

/** Narrows a validated label map; the caller must run validateLabelMap first. */
export function asLabelMapEntries(value: unknown): LabelMapEntry[] {
  return value as LabelMapEntry[];
}
