import { describe, it, expect } from 'vitest';
import { errorKeyFor } from '../src/lib/error-messages';

describe('errorKeyFor', () => {
  it.each([
    ['rate_limited', 'error.daily_limit'],
    ['ai_unavailable', 'error.unavailable'],
    ['ai_invalid_output', 'error.unreadable'],
    ['too_large', 'error.too_large'],
    ['bad_request', 'error.bad_request'],
    ['weird', 'error.generic'],
  ])('%s', (c, k) => {
    expect(errorKeyFor(c)).toBe(k);
  });
});
