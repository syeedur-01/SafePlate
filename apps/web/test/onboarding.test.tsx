import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EMPTY_PROFILE } from '@sp/contracts';
import { App } from '../src/App';
import { I18nProvider } from '../src/i18n/i18n';
import { Settings } from '../src/pages/Settings';
import { Onboarding } from '../src/pages/Onboarding';
import { LocalProfileStore, PROFILE_KEY } from '../src/state/profile-store';

const CLOCK = '2026-10-25T12:00:00.000Z';

const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Onboarding', () => {
  it('skip saves only the language with no health data or consent', async () => {
    const user = userEvent.setup();
    const store = new LocalProfileStore(mem());
    const onDone = vi.fn();

    render(
      <I18nProvider lang="en">
        <Onboarding store={store} now={() => CLOCK} onDone={onDone} />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Skip' }));

    expect(store.load()).toEqual({
      ...EMPTY_PROFILE,
      conditions: [],
      allergies: [],
      consentedAt: null,
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('requires consent before saving selected conditions', async () => {
    const user = userEvent.setup();
    const store = new LocalProfileStore(mem());

    render(
      <I18nProvider lang="en">
        <Onboarding store={store} now={() => CLOCK} onDone={() => {}} />
      </I18nProvider>,
    );

    const saveButton = screen.getByRole('button', { name: 'Save' });
    await user.click(screen.getByRole('checkbox', { name: 'Diabetes' }));
    expect(saveButton).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /only on this device/i }));
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    const saved = store.load();
    expect(saved.conditions).toEqual(['diabetes']);
    expect(saved.consentedAt).toBe(CLOCK);
  });

  it('never calls fetch while completing onboarding', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const store = new LocalProfileStore(mem());

    render(
      <I18nProvider lang="en">
        <Onboarding store={store} now={() => CLOCK} onDone={() => {}} />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('checkbox', { name: 'Diabetes' }));
    await user.click(screen.getByRole('checkbox', { name: /only on this device/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('opens onboarding when no profile is saved', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Tell us about you' })).toBeInTheDocument();
  });
});

describe('Settings', () => {
  it('delete my data removes the stored key', async () => {
    const user = userEvent.setup();
    const storage = mem();
    const store = new LocalProfileStore(storage);
    store.save({
      ...EMPTY_PROFILE,
      conditions: ['diabetes'],
      consentedAt: CLOCK,
    });

    render(
      <I18nProvider lang="en">
        <MemoryRouter>
          <Settings store={store} />
        </MemoryRouter>
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Delete my data' }));

    expect(storage.m.has(PROFILE_KEY)).toBe(false);
  });
});
