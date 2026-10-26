import { describe, it, expect } from 'vitest';
import { cn } from '../src/lib/cn';

describe('cn', () => {
  it('merges and de-duplicates tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
  it('drops falsy values', () => {
    const includeB: boolean = false;
    expect(cn('a', includeB && 'b', undefined, 'c')).toBe('a c');
  });
});
