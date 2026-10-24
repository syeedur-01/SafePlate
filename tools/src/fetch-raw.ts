/**
 * Fetches the FCTB PDF and USDA FoodData Central CSVs into data/raw/.
 * Validates content signatures before writing. Exits with code 2 on any failure.
 */
import {
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, resolve, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import {
  planTargets,
  humanInstructions,
  validatePdf,
  validateZip,
  USDA_RELEASES,
  USDA_DOWNLOAD_PAGE,
  type RawTarget,
  type UsdaRelease,
} from './fetch-raw-lib.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const UA = 'SafePlate-data-fetcher/0.2 (research; contact via GitHub)';
const TIMEOUT_MS = 180_000; // 3 min for large archives

function ensureDir(abs: string): void {
  mkdirSync(abs, { recursive: true });
}

/** Downloads a URL, returns body as Buffer. Returns null on failure and logs the error. */
async function download(url: string): Promise<Buffer | null> {
  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error(`    ✗ Network error: ${String(e)}`);
    return null;
  }
  if (!resp.ok) {
    console.error(`    ✗ HTTP ${resp.status} ${resp.statusText}`);
    return null;
  }
  try {
    return Buffer.from(await resp.arrayBuffer());
  } catch (e) {
    console.error(`    ✗ Failed to read response body: ${String(e)}`);
    return null;
  }
}

/** Validates and saves the FCTB PDF. */
async function fetchFctb(target: RawTarget): Promise<boolean> {
  if (!target.url) return false;
  console.log(`  Fetching ${target.url} …`);
  const buf = await download(target.url);
  if (!buf) return false;

  const v = validatePdf(buf);
  if (!v.ok) {
    console.error(`  ✗ PDF validation failed: ${v.reason}`);
    return false;
  }

  const absPath = resolve(ROOT, target.dest);
  ensureDir(dirname(absPath));
  const tmp = `${absPath}.tmp`;
  try {
    writeFileSync(tmp, buf);
    writeFileSync(absPath, buf);
    rmSync(tmp, { force: true });
  } catch (e) {
    console.error(`  ✗ Write failed: ${String(e)}`);
    rmSync(tmp, { force: true });
    return false;
  }
  console.log(`  ✓ Saved ${target.dest} (${buf.length.toLocaleString()} bytes)`);
  return true;
}

/** Extracts buf into destDir using adm-zip, guarding against path traversal. Returns CSV count. */
function extractZip(buf: Buffer, destDir: string): { ok: boolean; csvCount: number } {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buf);
  } catch (e) {
    console.error(`    ✗ ZIP parse error (corrupt archive?): ${String(e)}`);
    return { ok: false, csvCount: 0 };
  }

  const entries = zip.getEntries();
  if (entries.length === 0) {
    console.error('    ✗ ZIP archive contains no entries');
    return { ok: false, csvCount: 0 };
  }

  const absDestDir = resolve(ROOT, destDir);
  ensureDir(absDestDir);

  let csvCount = 0;
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const entryDest = normalize(join(absDestDir, entry.entryName));
    const rel = relative(absDestDir, entryDest);
    if (rel.startsWith('..') || normalize(rel) === '..') {
      console.error(`    ✗ Path traversal detected in archive: ${entry.entryName}`);
      return { ok: false, csvCount: 0 };
    }
    ensureDir(dirname(entryDest));
    writeFileSync(entryDest, entry.getData());
    if (entry.entryName.toLowerCase().endsWith('.csv')) csvCount++;
  }

  if (csvCount === 0) {
    console.error('    ✗ No CSV files found after extraction');
    return { ok: false, csvCount: 0 };
  }
  return { ok: true, csvCount };
}

/** Fetches, validates, and extracts one USDA release. */
async function fetchUsdaRelease(release: UsdaRelease): Promise<boolean> {
  console.log(`  [${release.name}] → ${release.dest}/`);

  // Skip if already extracted with CSV content
  const absDestDir = resolve(ROOT, release.dest);
  if (existsSync(absDestDir)) {
    const allFiles = readdirSync(absDestDir, { recursive: true }) as string[];
    const csvFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.csv'));
    const hasContent = csvFiles.some((f) => {
      try {
        return statSync(join(absDestDir, f)).size > 0;
      } catch {
        return false;
      }
    });
    if (hasContent) {
      console.log(`    ↷ Already extracted (${csvFiles.length} CSV file(s)). Skipping.`);
      return true;
    }
  }

  console.log(`    Fetching ${release.url} …`);
  const buf = await download(release.url);
  if (!buf) return false;

  const v = validateZip(buf);
  if (!v.ok) {
    console.error(`    ✗ ZIP validation failed: ${v.reason}`);
    return false;
  }
  console.log(`    Validated ZIP (${buf.length.toLocaleString()} bytes). Extracting …`);

  // Save archive file
  const archiveName = release.url.split('/').at(-1) ?? 'archive.zip';
  const archivePath = resolve(ROOT, release.dest, archiveName);
  ensureDir(resolve(ROOT, release.dest));
  writeFileSync(archivePath, buf);

  const { ok, csvCount } = extractZip(buf, release.dest);
  if (!ok) {
    rmSync(archivePath, { force: true });
    return false;
  }

  console.log(`    ✓ Extracted ${csvCount} CSV file(s) to ${release.dest}/`);
  return true;
}

/** Fetches all configured USDA releases. */
async function fetchUsda(): Promise<boolean> {
  console.log(`  Official page: ${USDA_DOWNLOAD_PAGE}`);
  let anyFailed = false;
  for (const release of USDA_RELEASES) {
    const ok = await fetchUsdaRelease(release);
    if (!ok) anyFailed = true;
  }
  return !anyFailed;
}

async function main(): Promise<void> {
  const ingredientsPath = resolve(ROOT, 'packages/knowledge/data/source/ingredients.json');
  const ingredientsData = JSON.parse(readFileSync(ingredientsPath, 'utf8')) as {
    metadata: { allowed_sources: Array<{ url: string }> };
  };
  const fctbUrl = ingredientsData.metadata.allowed_sources[0]?.url;
  if (!fctbUrl) {
    console.error(
      'ERROR: Could not find FCTB URL in ingredients.json metadata.allowed_sources[0].url',
    );
    process.exitCode = 2;
    return;
  }

  const targets = planTargets(fctbUrl);
  const failed: RawTarget[] = [];

  console.log('SafePlate raw source fetcher\n');
  for (const target of targets) {
    console.log(`[${target.id}] → ${target.dest}`);
    const ok = target.id === 'fctb' ? await fetchFctb(target) : await fetchUsda();
    if (!ok) failed.push(target);
    console.log('');
  }

  if (failed.length > 0) {
    console.log(humanInstructions(failed));
    process.exitCode = 2;
  } else {
    console.log('All sources fetched and validated successfully.');
  }
}

main().catch((err: unknown) => {
  console.error('Unexpected error:', err);
  process.exitCode = 2;
});
