import { describe, it, expect } from 'vitest';
import { EMPTY_PROFILE } from '@sp/contracts';
import { LocalProfileStore, PROFILE_KEY } from '../src/state/profile-store';

const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
};

describe('LocalProfileStore', () => {
  it('returns the empty profile when nothing is saved', () => {
    expect(new LocalProfileStore(mem()).load()).toEqual(EMPTY_PROFILE);
  });
  it('round-trips a profile', () => {
    const s = new LocalProfileStore(mem());
    const p = {
      ...EMPTY_PROFILE,
      conditions: ['diabetes' as const],
      consentedAt: '2026-10-25T00:00:00.000Z',
    };
    s.save(p);
    expect(s.load()).toEqual(p);
  });
  it('ignores corrupt or invalid data', () => {
    const st = mem();
    st.setItem(PROFILE_KEY, '{oops');
    expect(new LocalProfileStore(st).load()).toEqual(EMPTY_PROFILE);
    st.setItem(PROFILE_KEY, JSON.stringify({ conditions: ['flu'] }));
    expect(new LocalProfileStore(st).load()).toEqual(EMPTY_PROFILE);
  });
  it('clear removes the key', () => {
    const st = mem();
    const s = new LocalProfileStore(st);
    s.save(EMPTY_PROFILE);
    s.clear();
    expect(st.m.has(PROFILE_KEY)).toBe(false);
  });
});
