import { createHash } from 'node:crypto';

export interface HashedFile {
  path: string;
  hash: string;
}

/** Returns the SHA-256 hex digest of the bytes. */
export function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Returns every group of two or more files whose bytes are identical. */
export function duplicateGroups(files: readonly HashedFile[]): string[][] {
  const byHash = new Map<string, string[]>();
  for (const f of files) {
    const list = byHash.get(f.hash);
    if (list === undefined) byHash.set(f.hash, [f.path]);
    else list.push(f.path);
  }
  return [...byHash.values()].filter((paths) => paths.length > 1);
}

export interface SplitLeak {
  hash: string;
  dev: string[];
  holdout: string[];
}

/**
 * Returns hashes whose identical bytes appear in both the dev and holdout splits (evaluation
 * leakage). Duplicates confined to dev+unused or holdout+unused are not leaks.
 */
export function splitLeaks(
  files: readonly HashedFile[],
  splitOf: (path: string) => 'dev' | 'holdout' | 'unused',
): SplitLeak[] {
  const byHash = new Map<string, string[]>();
  for (const f of files) {
    const list = byHash.get(f.hash);
    if (list === undefined) byHash.set(f.hash, [f.path]);
    else list.push(f.path);
  }
  const leaks: SplitLeak[] = [];
  for (const [hash, paths] of byHash) {
    if (paths.length < 2) continue;
    const dev = paths.filter((p) => splitOf(p) === 'dev');
    const holdout = paths.filter((p) => splitOf(p) === 'holdout');
    if (dev.length > 0 && holdout.length > 0) leaks.push({ hash, dev, holdout });
  }
  return leaks;
}
