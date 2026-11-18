import { ScanResultSchema, type ScanRequest, type ScanResult } from '@sp/contracts';

/**
 * Bump this when anything that changes a scan result changes: the prompts, the output
 * schema, or the provider call behaviour. Old cache entries then simply expire instead
 * of being served across incompatible revisions.
 */
export const SCAN_CACHE_VERSION = '1';

export interface ScanCache {
  /** Identifies the adapter implementation ('memory', 'kv', ...); undefined for ad-hoc caches. */
  readonly kind?: string;
  get(key: string): Promise<ScanResult | null>;
  set(key: string, value: ScanResult, ttlSeconds: number): Promise<void>;
}

interface CacheEntry {
  value: ScanResult;
  expiresAt: number;
}

/** In-memory cache with a per-entry TTL in seconds; reading an expired entry drops it. */
export class MemoryScanCache implements ScanCache {
  readonly kind = 'memory' as const;

  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly now: () => number = Date.now) {}

  async get(key: string): Promise<ScanResult | null> {
    const entry = this.entries.get(key);
    if (entry === undefined) return null;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: ScanResult, ttlSeconds: number): Promise<void> {
    this.entries.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }
}

/** Minimal shape of a Workers KV namespace; satisfied by the real binding and by test fakes. */
export interface KvNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * Workers KV cache adapter. KV is eventually consistent, so this is a best-effort cache:
 * an immediate re-scan may miss an entry another instance just wrote. Values are
 * schema-validated on read so a stale or foreign entry is dropped, never served.
 */
export class KvScanCache implements ScanCache {
  readonly kind = 'kv' as const;

  constructor(private readonly kv: KvNamespace) {}

  async get(key: string): Promise<ScanResult | null> {
    const raw = await this.kv.get(key);
    if (raw === null) return null;
    try {
      return ScanResultSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async set(key: string, value: ScanResult, ttlSeconds: number): Promise<void> {
    // Workers KV requires an expirationTtl of at least 60 seconds.
    await this.kv.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, ttlSeconds) });
  }
}

/**
 * Returns the SHA-256 hex of the cache version, provider scope, kind, MIME type and image
 * bytes so the same photo under the same provider/model/prompt revision reuses one result,
 * and any revision change produces a different key.
 */
export async function imageCacheKey(
  req: ScanRequest,
  scope?: { provider?: string; model?: string },
): Promise<string> {
  const parts = [
    SCAN_CACHE_VERSION,
    scope?.provider ?? '',
    scope?.model ?? '',
    req.kind,
    req.mimeType,
    req.imageBase64,
  ];
  const data = new TextEncoder().encode(parts.join('\n'));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
