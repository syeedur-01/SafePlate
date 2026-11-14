import { createElement } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EMPTY_PROFILE } from '@sp/contracts';
import { I18nProvider } from '../src/i18n/i18n';
import { Settings } from '../src/pages/Settings';
import { HISTORY_KEY, HistoryStore, type HistoryEntry } from '../src/state/history-store';
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

let seq = 0;
const makeEntry = (at: string, id = String(++seq)): HistoryEntry => ({
  id,
  at,
  dishId: null,
  title: `Dish ${id}`,
  score: 50,
  level: 'moderate',
  thumb: null,
});

afterEach(() => {
  cleanup();
});

describe('HistoryStore', () => {
  it('lists entries newest first', () => {
    const store = new HistoryStore(mem());
    store.add(makeEntry('2026-10-20T10:00:00.000Z', 'old'));
    store.add(makeEntry('2026-10-25T10:00:00.000Z', 'new'));
    store.add(makeEntry('2026-10-22T10:00:00.000Z', 'middle'));

    expect(store.list().map((entry) => entry.id)).toEqual(['new', 'middle', 'old']);
  });

  it('keeps at most 20 entries and drops the oldest', () => {
    const store = new HistoryStore(mem());
    for (let day = 1; day <= 21; day += 1) {
      const at = `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`;
      store.add(makeEntry(at, `day-${day}`));
    }

    const list = store.list();
    expect(list).toHaveLength(20);
    expect(list.some((entry) => entry.id === 'day-1')).toBe(false);
    expect(list[0]?.id).toBe('day-21');
  });

  it('returns an empty list for corrupt JSON', () => {
    const storage = mem();
    storage.setItem(HISTORY_KEY, '{not json');
    expect(new HistoryStore(storage).list()).toEqual([]);
  });

  it('clear removes the stored key', () => {
    const storage = mem();
    const store = new HistoryStore(storage);
    store.add(makeEntry('2026-10-25T10:00:00.000Z'));

    store.clear();

    expect(storage.m.has(HISTORY_KEY)).toBe(false);
    expect(store.list()).toEqual([]);
  });
});

describe('Settings', () => {
  it('delete my data removes the profile and the history', async () => {
    const user = userEvent.setup();
    const storage = mem();
    const profileStore = new LocalProfileStore(storage);
    profileStore.save({ ...EMPTY_PROFILE, conditions: ['diabetes'], consentedAt: '2026-10-25' });
    new HistoryStore(storage).add(makeEntry('2026-10-25T10:00:00.000Z'));

    render(
      createElement(I18nProvider, {
        lang: 'en',
        children: createElement(
          MemoryRouter,
          null,
          createElement(Settings, { store: profileStore, historyStore: new HistoryStore(storage) }),
        ),
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Delete my data' }));

    expect(storage.m.has(PROFILE_KEY)).toBe(false);
    expect(storage.m.has(HISTORY_KEY)).toBe(false);
  });
});
