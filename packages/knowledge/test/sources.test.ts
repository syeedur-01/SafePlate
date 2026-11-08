import { describe, it, expect } from 'vitest';
import { SourcesFileSchema } from '@sp/contracts';
import { getSources } from '../src';
describe('sources register', () => {
  const list = getSources();
  it('validates and has unique ids', () => {
    expect(SourcesFileSchema.safeParse({ sources: list }).success).toBe(true);
    expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
  });
  it('contains the core sources', () => {
    for (const id of ['bd-dietary-guidelines', 'bd-fctb-2013', 'who-nugag', 'codex-texts'])
      expect(list.some((s) => s.id === id)).toBe(true);
  });
  it('a verified source has an access date', () => {
    for (const s of list) if (s.status === 'verified') expect(s.accessedOn).not.toBeNull();
  });
});
