import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { DishScanResult } from '@sp/contracts';
import { getMessages } from '@sp/knowledge';
import { I18nProvider, registerMessages } from '../src/i18n/i18n';
import { Result } from '../src/pages/Result';

vi.mock('@sp/knowledge/data/rules/safety-rules.json', async (importOriginal) => {
  const actual = await importOriginal<{ default: { rules: unknown[] } }>();
  return {
    default: {
      ...actual.default,
      rules: [
        ...actual.default.rules,
        {
          id: 'fixture-draft-rule',
          trigger: { type: 'spoilage_sign', sign: 'visible_mold' },
          points: 40,
          labelKey: 'safety.spoilage-visible-mold',
          mitigationKeys: [],
          sourceRef: null,
          status: 'draft',
        },
      ],
    },
  };
});

registerMessages(getMessages());

const KACCHI_SCAN: DishScanResult = {
  kind: 'dish',
  candidates: [{ dishId: 'kacchi-biryani', label: 'Kacchi Biryani', confidence: 0.82 }],
  observations: { spoilageSigns: [], imageQuality: 'good', notes: '' },
  provider: 'mock',
  cached: false,
};

function renderResultPage() {
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
        <Routes>
          <Route path="/result" element={<Result />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe('Result page', () => {
  it('renders the four tabs and the chemical notice', () => {
    renderResultPage();

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Safety',
      'For you',
      'Nutrition',
      'Swap and shopping',
    ]);
    expect(screen.getByText(/cannot detect invisible chemical contamination/)).toBeInTheDocument();
  });

  it('shows the identified-but-unsupported state for a catalogue-only dish', () => {
    render(
      <I18nProvider lang="en">
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/result',
              state: {
                scanResult: {
                  kind: 'dish',
                  candidates: [{ dishId: 'singara', label: 'Singara', confidence: 0.9 }],
                  observations: { spoilageSigns: [], imageQuality: 'good', notes: '' },
                  provider: 'mock',
                  cached: false,
                } satisfies DishScanResult,
                dishId: 'singara',
                thumbDataUrl: null,
              },
            },
          ]}
        >
          <Routes>
            <Route path="/result" element={<Result />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByText('Singara')).toBeInTheDocument();
    expect(screen.getByText(/does not have reviewed nutrition or safety data/)).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('shows the scanned photo and dish title in the result header', () => {
    render(
      <I18nProvider lang="en">
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/result',
              state: {
                scanResult: KACCHI_SCAN,
                dishId: 'kacchi-biryani',
                thumbDataUrl: 'data:image/jpeg;base64,AAAA',
              },
            },
          ]}
        >
          <Routes>
            <Route path="/result" element={<Result />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Kacchi Biryani' })).toBeInTheDocument();
    const thumb = document.querySelector('header img');
    expect(thumb).toHaveAttribute('src', 'data:image/jpeg;base64,AAAA');
    expect(screen.getByText(/Estimated from the photo you scanned/)).toBeInTheDocument();
  });

  it('shows the estimated badge on the Nutrition tab', async () => {
    const user = userEvent.setup();
    renderResultPage();

    await user.click(screen.getByRole('tab', { name: 'Nutrition' }));

    expect(await screen.findByText('Estimated')).toBeInTheDocument();
  });

  it('shows the draft rules badge when a loaded rule is draft', () => {
    renderResultPage();

    expect(screen.getByText('Draft')).toBeInTheDocument();
  });
});
