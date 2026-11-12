import type { ScanRequest, ScanResult } from '@sp/contracts';

export interface ScanCache {
  get(key: string): Promise<ScanResult | null>;
  set(key: string, value: ScanResult, ttlSeconds: number): Promise<void>;
}

interface CacheEntry {
  value: ScanResult;
  expiresAt: number;
}

/** In-memory cache with a per-entry TTL in seconds; reading an expired entry drops it. */
export class MemoryScanCache implements ScanCache {
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

/** Returns the SHA-256 hex of kind, mimeType and imageBase64 so the same photo reuses one result. */
export async function imageCacheKey(req: ScanRequest): Promise<string> {
  const data = new TextEncoder().encode(`${req.kind}\n${req.mimeType}\n${req.imageBase64}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
