/**
 * Pure, testable helpers for the raw-source downloader.
 * No network access, no filesystem changes, no console output.
 */

/** A file target that the fetch script should download. */
export interface RawTarget {
  id: string;
  /** Direct URL, or null if the script must discover it from the official page. */
  url: string | null;
  /** Relative path inside the repo root. Directory for ZIP targets, file path for single files. */
  dest: string;
  manualHint: string;
}

/** Configuration for a known USDA dataset release. */
export interface UsdaRelease {
  name: string;
  url: string;
  dest: string; // relative dir under data/raw/usda/
}

/** The currently identified USDA FoodData Central download page. */
export const USDA_DOWNLOAD_PAGE = 'https://fdc.nal.usda.gov/download-datasets/';

/**
 * The two USDA releases required by this project.
 * IMPORTANT: USDA releases change. Verify these URLs against the official download page
 * before updating to a newer release. Do not guess filenames.
 */
export const USDA_RELEASES: UsdaRelease[] = [
  {
    name: 'Foundation Foods (April 2026)',
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip',
    dest: 'data/raw/usda/foundation-foods',
  },
  {
    name: 'SR Legacy (April 2018, final)',
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
    dest: 'data/raw/usda/sr-legacy',
  },
];

/** Returns the list of targets to fetch. url is null for the aggregated USDA target. */
export function planTargets(fctbUrl: string): RawTarget[] {
  return [
    {
      id: 'fctb',
      url: fctbUrl,
      dest: 'data/raw/fctb-2013.pdf',
      manualHint:
        'Download the Food Composition Table for Bangladesh (FCTB 2013) PDF:\n' +
        `  URL: ${fctbUrl}\n` +
        '  Save as: data/raw/fctb-2013.pdf\n' +
        '  The file must begin with the PDF signature (%PDF-) and be non-empty.',
    },
    {
      id: 'usda',
      url: null,
      dest: 'data/raw/usda/',
      manualHint:
        'Download USDA FoodData Central CSV archives manually:\n' +
        `  Official download page: ${USDA_DOWNLOAD_PAGE}\n` +
        '  Required releases:\n' +
        USDA_RELEASES.map(
          (r) =>
            `    • ${r.name}\n` +
            `      URL: ${r.url}\n` +
            `      Download archive.zip → extract into: ${r.dest}/`,
        ).join('\n') +
        '\n' +
        '  After extraction each directory should contain food.csv, nutrient.csv, food_nutrient.csv.\n' +
        '  Do NOT rename, merge, or alter the CSV files. Raw data only.',
    },
  ];
}

/** Returns a human-readable instruction block for targets that could not be fetched. */
export function humanInstructions(failed: RawTarget[]): string {
  if (failed.length === 0) return '';
  const lines: string[] = [
    '══════════════════════════════════════════════════════════',
    'MANUAL DOWNLOAD REQUIRED',
    'The following source files could not be fetched automatically.',
    'A human must complete these steps before running P1-D02 / P1-D03:',
    '',
  ];
  for (const t of failed) {
    lines.push(`▸ [${t.id}] → ${t.dest}`);
    lines.push(t.manualHint);
    lines.push('');
  }
  lines.push('══════════════════════════════════════════════════════════');
  return lines.join('\n');
}

// ── Content validation ───────────────────────────────────────────────────────

/** PDF magic bytes: %PDF- */
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
/** ZIP magic bytes: PK\x03\x04 */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
/** Minimum reasonable size for a real PDF or ZIP (1 KB). */
const MIN_BYTES = 1024;

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * Validates that `buf` looks like a real PDF:
 * - non-empty and at least MIN_BYTES
 * - starts with the PDF magic signature %PDF-
 * - does not look like an HTML error page
 */
export function validatePdf(buf: Buffer): ValidationResult {
  if (buf.length < MIN_BYTES) {
    return { ok: false, reason: `Too small: ${buf.length} bytes (minimum ${MIN_BYTES})` };
  }
  const head = buf.subarray(0, 5);
  if (!head.equals(PDF_MAGIC)) {
    // Detect common error responses
    const text = buf.subarray(0, 100).toString('utf8', 0, 100);
    if (text.trimStart().startsWith('<')) {
      return { ok: false, reason: 'Response is an HTML page, not a PDF' };
    }
    if (text.trimStart().startsWith('{')) {
      return { ok: false, reason: 'Response is a JSON document, not a PDF' };
    }
    return { ok: false, reason: `Missing PDF signature. Got: ${head.toString('hex')}` };
  }
  return { ok: true };
}

/**
 * Validates that `buf` looks like a real ZIP archive:
 * - non-empty and at least MIN_BYTES
 * - starts with the ZIP local file header signature PK\x03\x04
 * - does not look like an HTML or JSON error page
 */
export function validateZip(buf: Buffer): ValidationResult {
  if (buf.length < MIN_BYTES) {
    return { ok: false, reason: `Too small: ${buf.length} bytes (minimum ${MIN_BYTES})` };
  }
  const head = buf.subarray(0, 4);
  if (!head.equals(ZIP_MAGIC)) {
    const text = buf.subarray(0, 100).toString('utf8', 0, 100);
    if (text.trimStart().startsWith('<')) {
      return { ok: false, reason: 'Response is an HTML page, not a ZIP' };
    }
    if (text.trimStart().startsWith('{')) {
      return { ok: false, reason: 'Response is a JSON document, not a ZIP' };
    }
    return { ok: false, reason: `Missing ZIP signature. Got: ${head.toString('hex')}` };
  }
  return { ok: true };
}
