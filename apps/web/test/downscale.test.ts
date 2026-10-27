import { describe, it, expect } from 'vitest';
import { computeTargetSize } from '../src/lib/downscale';

describe('computeTargetSize', () => {
  it('shrinks the long side to max and keeps aspect', () => {
    expect(computeTargetSize(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 });
  });
  it('handles portrait', () => {
    expect(computeTargetSize(3000, 4000, 1024)).toEqual({ width: 768, height: 1024 });
  });
  it('never upscales', () => {
    expect(computeTargetSize(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });
  it('keeps at least one pixel on the short side', () => {
    expect(computeTargetSize(4000, 1, 1024)).toEqual({ width: 1024, height: 1 });
  });
});
