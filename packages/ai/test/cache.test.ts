import { describe, it, expect } from 'vitest';
import { MemoryScanCache, imageCacheKey } from '../src/cache';

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
});
