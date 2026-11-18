import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { summarizeSizes, withinBudget } from '../src/lib/size-report';

/**
 * Prints gzip sizes of the built assets, confirms the knowledge data is bundled once and no
 * images are bundled, and exits non-zero when the JS total is over the budget.
 */

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSETS_DIR = resolve(APP_ROOT, 'dist', 'assets');
const BUDGET_FILE = resolve(APP_ROOT, 'size-budget.json');
/**
 * Locates the runtime.json knowledge data in the built chunks. runtime.json orders its
 * ingredient entries `id -> name_en -> name_bn -> energy_kcal`, while the normalized files
 * end every ingredient with `name_bn`, so this adjacency occurs only in runtime data.
 */
const RUNTIME_MARKER = /name_bn:"[^"]*",energy_kcal:/;
const IMAGE_PATTERN = /\.(png|jpe?g|webp|gif|avif|svg|ico)$/i;

function fail(message: string): never {
  console.error(`size: ${message}`);
  process.exit(1);
}

if (!existsSync(ASSETS_DIR)) {
  fail('dist/assets not found - run `pnpm --filter @sp/web build` first');
}

const assetNames = readdirSync(ASSETS_DIR).filter(
  (name) => name.endsWith('.js') || name.endsWith('.css'),
);
if (assetNames.length === 0) {
  fail('dist/assets has no built JavaScript or CSS - run the build first');
}

const entries = assetNames.map((file) => ({
  file,
  gzipBytes: gzipSync(readFileSync(resolve(ASSETS_DIR, file))).byteLength,
}));
const jsTotal = entries
  .filter((entry) => entry.file.endsWith('.js'))
  .reduce((sum, entry) => sum + entry.gzipBytes, 0);
const cssTotal = entries
  .filter((entry) => entry.file.endsWith('.css'))
  .reduce((sum, entry) => sum + entry.gzipBytes, 0);
const { total, lines } = summarizeSizes(entries);

if (!existsSync(BUDGET_FILE)) {
  fail('size-budget.json not found - it stores the budget as first measured total + 10%');
}
const budgetFile: unknown = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'));
const budget =
  typeof budgetFile === 'object' && budgetFile !== null && 'jsGzipBudgetBytes' in budgetFile
    ? (budgetFile as { jsGzipBudgetBytes: number }).jsGzipBudgetBytes
    : undefined;
if (typeof budget !== 'number') {
  fail('size-budget.json must contain a numeric jsGzipBudgetBytes');
}

console.log('gzip sizes of dist/assets:');
for (const line of lines) {
  console.log(`  ${line}`);
}
console.log(`  JS total:  ${jsTotal} B`);
console.log(`  CSS total: ${cssTotal} B`);
console.log(`  all files: ${total} B`);
console.log(`  budget:    ${budget} B (first measured total + 10%)`);

// The runtime knowledge data must live in exactly one built chunk.
const jsFiles = assetNames.filter((name) => name.endsWith('.js'));
const chunksWithRuntime = jsFiles.filter((name) =>
  RUNTIME_MARKER.test(readFileSync(resolve(ASSETS_DIR, name), 'utf8')),
);
if (chunksWithRuntime.length !== 1) {
  fail(
    `runtime knowledge data marker found in ${chunksWithRuntime.length} chunks (${chunksWithRuntime.join(', ')}) - expected exactly 1`,
  );
}
console.log(`  runtime knowledge data bundled once (in ${chunksWithRuntime[0]})`);

// User photos only ever exist as runtime data URLs, so no image file may be bundled.
const bundledImages = readdirSync(ASSETS_DIR).filter((name) => IMAGE_PATTERN.test(name));
if (bundledImages.length > 0) {
  fail(`unexpected image assets bundled: ${bundledImages.join(', ')}`);
}
console.log('  no image files bundled (user photos stay runtime data URLs)');

if (!withinBudget(jsTotal, budget)) {
  fail(`JS total ${jsTotal} B exceeds budget ${budget} B`);
}
console.log(`within budget: JS ${jsTotal} B <= ${budget} B`);
