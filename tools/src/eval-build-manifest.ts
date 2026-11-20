import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sha256Hex } from './eval-dedup';
import { asLabelMapEntries, validateLabelMap } from './eval-manifest';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const HOLDOUT_MODULUS = 5;

export interface BuildManifestArgs {
  dataset: string;
  map: string;
  out: string;
  source: string;
  licence: string;
  attribution: string | null;
}

/** Parses the CLI arguments of the manifest builder; throws on anything unknown or missing. */
export function parseBuildArgs(argv: string[]): BuildManifestArgs {
  const args: Partial<BuildManifestArgs> = { attribution: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    switch (arg) {
      case '--dataset':
      case '--map':
      case '--out':
      case '--source':
      case '--licence': {
        const key = arg.slice(2) as 'dataset' | 'map' | 'out' | 'source' | 'licence';
        const value = argv[i + 1];
        if (value === undefined || value === '') throw new Error(`${arg} needs a value`);
        args[key] = value;
        i += 1;
        break;
      }
      case '--attribution': {
        const value = argv[i + 1];
        if (value === undefined || value === '') throw new Error('--attribution needs a value');
        args['attribution'] = value;
        i += 1;
        break;
      }
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  for (const key of ['dataset', 'map', 'out', 'source', 'licence'] as const) {
    if (args[key] === undefined) throw new Error(`--${key} is required`);
  }
  return args as BuildManifestArgs;
}

/** Returns a deterministic dev/holdout split from an image id: every 5th id becomes holdout. */
export function deterministicSplit(imageId: string): 'dev' | 'holdout' {
  const byte = parseInt(sha256Hex(Buffer.from(imageId)).slice(0, 2), 16);
  return byte % HOLDOUT_MODULUS === 0 ? 'holdout' : 'dev';
}

/** Returns image files under a directory recursively, as paths relative to that directory. */
export function listImages(dir: string): string[] {
  const out: string[] = [];
  const visit = (relative: string): void => {
    const full = path.join(dir, relative);
    if (statSync(full).isDirectory()) {
      for (const name of readdirSync(full)) visit(relative === '' ? name : `${relative}/${name}`);
      return;
    }
    if (IMAGE_EXTENSIONS.has(path.extname(full).toLowerCase())) out.push(relative);
  };
  visit('');
  return out.sort();
}

/** Maps a dataset label through the label map; returns null for unknown or unmapped labels. */
export function mappedDishIdFor(
  datasetLabel: string,
  map: Map<string, string | null>,
): string | null {
  const entry = map.get(datasetLabel);
  return entry === undefined ? null : entry;
}

function main(): void {
  const args = parseBuildArgs(process.argv.slice(2));
  const labelMapValue: unknown = JSON.parse(readFileSync(args.map, 'utf8'));
  const problems = validateLabelMap(labelMapValue);
  if (problems.length > 0) {
    process.stderr.write(`eval-build-manifest: label map is invalid:\n${problems.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }
  // Proposals are not approvals: only approved mappings reach the manifest.
  const map = new Map(
    asLabelMapEntries(labelMapValue)
      .filter((e) => e.status === 'approved')
      .map((e) => [e.datasetLabel, e.safePlateDishId]),
  );

  const images = listImages(args.dataset);
  if (images.length === 0) {
    process.stderr.write(`eval-build-manifest: no images under ${args.dataset}\n`);
    process.exitCode = 1;
    return;
  }

  const seenHashes = new Map<string, string>();
  const entries = images.map((imagePath) => {
    const bytes = readFileSync(path.join(args.dataset, imagePath));
    const contentHash = sha256Hex(bytes);
    // imageId identifies the manifest entry, not the bytes; duplicates are tracked separately.
    const imageId = sha256Hex(Buffer.from(imagePath)).slice(0, 16);
    const datasetLabel = imagePath.split('/')[0]!;
    const firstPath = seenHashes.get(contentHash);
    const isDuplicate = firstPath !== undefined;
    if (firstPath === undefined) seenHashes.set(contentHash, imagePath);
    return {
      imageId,
      imagePath,
      kind: 'dish',
      datasetLabel,
      split: isDuplicate ? 'unused' : deterministicSplit(imageId),
      source: args.source,
      licence: args.licence,
      attribution: args.attribution,
      mappedDishId: mappedDishIdFor(datasetLabel, map),
      notes: isDuplicate ? `exact duplicate of ${firstPath}` : null,
    };
  });

  writeFileSync(args.out, `${JSON.stringify(entries, null, 2)}\n`);
  const evaluated = entries.filter((e) => e.mappedDishId !== null && e.split !== 'unused').length;
  process.stdout.write(
    `eval-build-manifest: ${entries.length} images, ${evaluated} mapped and split, ` +
      `${entries.filter((e) => e.split === 'unused').length} duplicates marked unused, ` +
      `${new Set(entries.map((e) => e.datasetLabel)).size} dataset labels -> ${args.out}\n`,
  );
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main();
}

export {};
