import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DishScanResult } from '@sp/contracts';
import { getMessages } from '@sp/knowledge';
import { App } from '../src/App';
import { I18nProvider, registerMessages } from '../src/i18n/i18n';
import { LocalProfileStore } from '../src/state/profile-store';

registerMessages(getMessages());

const KACCHI_SCAN: DishScanResult = {
  kind: 'dish',
  candidates: [{ dishId: 'kacchi-biryani', label: 'Kacchi Biryani', confidence: 0.82 }],
  observations: { spoilageSigns: [], imageQuality: 'good', notes: '' },
  provider: 'mock',
  cached: false,
};

beforeEach(() => {
  localStorage.clear();
  // A saved profile keeps the shell from redirecting to /welcome.
  new LocalProfileStore().save({
    language: 'en',
    conditions: [],
    allergies: [],
    consentedAt: null,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('app routes', () => {
  it('renders the result page when the scan flow navigates to /result', () => {
    render(
      <I18nProvider lang="en">
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/result',
              state: { scanResult: KACCHI_SCAN, dishId: 'kacchi-biryani', thumbDataUrl: null },
            },
          ]}
        >
          <App />
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByRole('tab', { name: 'Safety' })).toBeInTheDocument();
  });
});
