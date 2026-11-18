import { describe, it, expect } from 'vitest';
import { KvScanCache, MemoryScanCache, SCAN_CACHE_VERSION, imageCacheKey } from '../src/cache';
import { ScanResultSchema } from '@sp/contracts';

const req = (img: string, kind: 'dish' | 'label' = 'dish') => ({
  kind,
  imageBase64: img.padEnd(200, 'A'),
  mimeType: 'image/jpeg' as const,
  context: { place: 'home' as const, storage: 'unknown' as const, hoursSinceCooked: null },
});

describe('imageCacheKey', () => {
  it('is stable and 64 hex chars', async () => {
    const a = await imageCacheKey(req('x'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await imageCacheKey(req('x'))).toBe(a);
  });
  it('differs by image and by kind', async () => {
    expect(await imageCacheKey(req('x'))).not.toBe(await imageCacheKey(req('y')));
    expect(await imageCacheKey(req('x'))).not.toBe(await imageCacheKey(req('x', 'label')));
  });
  it('differs across provider, model and cache version scope', async () => {
    const base = await imageCacheKey(req('x'), { provider: 'gemini', model: 'm-1' });
    expect(await imageCacheKey(req('x'), { provider: 'mock', model: 'm-1' })).not.toBe(base);
    expect(await imageCacheKey(req('x'), { provider: 'gemini', model: 'm-2' })).not.toBe(base);
    expect(await imageCacheKey(req('x'))).not.toBe(base);
    expect(SCAN_CACHE_VERSION).toBe('1');
  });
});

describe('MemoryScanCache', () => {
  const val = {
    kind: 'dish' as const,
    candidates: [{ dishId: null, label: 'x', confidence: 0.1 }],
    observations: { spoilageSigns: [], imageQuality: 'good' as const, notes: '' },
    provider: 'm',
    cached: false,
  };
  it('returns a stored value until it expires', async () => {
    let t = 0;
    const c = new MemoryScanCache(() => t);
    await c.set('k', val, 10);
    expect(await c.get('k')).toEqual(val);
    t = 11_000;
    expect(await c.get('k')).toBeNull();
  });
  it('reports the memory kind for health reporting', () => {
    expect(new MemoryScanCache().kind).toBe('memory');
  });
});

describe('KvScanCache', () => {
  const val = {
    kind: 'dish' as const,
    candidates: [{ dishId: null, label: 'x', confidence: 0.1 }],
    observations: { spoilageSigns: [], imageQuality: 'good' as const, notes: '' },
    provider: 'm',
    cached: false,
  };
  interface FakeKv {
    store: Map<string, string>;
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  }
  const fakeKv = (): FakeKv & { lastTtl: number | undefined } => {
    const store = new Map<string, string>();
    let lastTtl: number | undefined;
    return {
      store,
      get lastTtl() {
        return lastTtl;
      },
      async get(key) {
        return store.get(key) ?? null;
      },
      async put(key, value, options) {
        lastTtl = options?.expirationTtl;
        store.set(key, value);
      },
    };
  };
  it('stores and reads back a result', async () => {
    const kv = fakeKv();
    const cache = new KvScanCache(kv);
    await cache.set('k', val, 86_400);
    expect(kv.lastTtl).toBe(86_400);
    expect(await cache.get('k')).toEqual(val);
    expect(await cache.get('missing')).toBeNull();
  });
  it('drops unreadable or schema-invalid entries instead of serving them', async () => {
    const kv = fakeKv();
    kv.store.set('bad-json', '{not json');
    kv.store.set('bad-shape', JSON.stringify({ kind: 'dish' }));
    const cache = new KvScanCache(kv);
    expect(await cache.get('bad-json')).toBeNull();
    expect(await cache.get('bad-shape')).toBeNull();
  });
  it('raises the TTL to the KV minimum of 60 seconds', async () => {
    const kv = fakeKv();
    const cache = new KvScanCache(kv);
    await cache.set('k', val, 5);
    expect(kv.lastTtl).toBe(60);
  });
  it('reports the kv kind for health reporting', () => {
    expect(new KvScanCache(fakeKv()).kind).toBe('kv');
  });
  it('stores values that satisfy the scan result schema', async () => {
    const kv = fakeKv();
    const cache = new KvScanCache(kv);
    await cache.set('k', val, 60);
    expect(ScanResultSchema.safeParse(JSON.parse(kv.store.get('k') ?? '')).success).toBe(true);
  });
});
