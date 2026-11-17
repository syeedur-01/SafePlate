import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSlowNotice } from '../src/lib/useSlowNotice';

describe('useSlowNotice', () => {
  it('turns on after the delay and resets when loading stops', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ l }) => useSlowNotice(l, 8000), {
      initialProps: { l: true },
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(8001);
    });
    expect(result.current).toBe(true);
    rerender({ l: false });
    expect(result.current).toBe(false);
    vi.useRealTimers();
  });
});
