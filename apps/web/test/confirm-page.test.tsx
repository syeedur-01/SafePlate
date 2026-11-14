import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { DishScanResult, LabelScanResult, ScanResult } from '@sp/contracts';
import { I18nProvider } from '../src/i18n/i18n';
import { Confirm } from '../src/pages/Confirm';

const observations = { spoilageSigns: [], imageQuality: 'good' as const, notes: '' };

const dishResult: DishScanResult = {
  kind: 'dish',
  candidates: [
    { dishId: 'kacchi-biryani', label: 'Kacchi Biryani', confidence: 0.82 },
    { dishId: 'beef-tehari', label: 'Beef Tehari', confidence: 0.12 },
    { dishId: 'morog-polao', label: 'Morog Polao', confidence: 0.04 },
  ],
  observations,
  provider: 'mock',
  cached: false,
};

const unsureResult: DishScanResult = {
  ...dishResult,
  candidates: [{ dishId: 'kacchi-biryani', label: 'Kacchi Biryani', confidence: 0.3 }],
};

const labelResult: LabelScanResult = {
  kind: 'label',
  productName: null,
  ingredientsText: null,
  declaredAllergens: [],
  expiryDate: null,
  nutritionPer100g: null,
  observations,
  provider: 'mock',
  cached: false,
};

const scanState = (result: ScanResult) => ({
  result,
  thumbDataUrl: 'data:image/jpeg;base64,AAAA',
});

function ResultStub() {
  const location = useLocation();
  const state = location.state as { dishId: string | null } | null;
  return <div data-testid="result-stub">{state === null ? 'no-state' : String(state.dishId)}</div>;
}

function renderConfirm(state?: { result: ScanResult; thumbDataUrl: string }) {
  render(
    <I18nProvider lang="en">
      <MemoryRouter initialEntries={[{ pathname: '/confirm', state }]}>
        <Routes>
          <Route path="/" element={<div data-testid="home" />} />
          <Route path="/confirm" element={<Confirm />} />
          <Route path="/result" element={<ResultStub />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe('Confirm page', () => {
  it('shows at most three candidate buttons with a best-guess label', () => {
    renderConfirm(scanState(dishResult));

    const region = screen.getByRole('region', { name: 'Best matches' });

    expect(within(region).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText('Best guess')).toBeInTheDocument();
  });

  it('narrows the dish list as the user types', async () => {
    const user = userEvent.setup();
    renderConfirm(scanState(dishResult));

    const list = screen.getByRole('list', { name: 'All dishes' });
    expect(within(list).getAllByRole('button')).toHaveLength(30);

    await user.type(screen.getByLabelText('Search dishes'), 'fuchka');

    expect(within(list).getAllByRole('button')).toHaveLength(1);
  });

  it('navigates to the result with the chosen dish', async () => {
    const user = userEvent.setup();
    renderConfirm(scanState(dishResult));

    const region = screen.getByRole('region', { name: 'Best matches' });
    await user.click(within(region).getByRole('button', { name: 'Kacchi Biryani' }));

    expect(await screen.findByTestId('result-stub')).toHaveTextContent('kacchi-biryani');
  });

  it('shows the not-sure message and focuses search when confidence is low', () => {
    renderConfirm(scanState(unsureResult));

    expect(screen.getByText(/We're not sure/)).toBeInTheDocument();
    expect(screen.getByLabelText('Search dishes')).toHaveFocus();
  });

  it('sends a label result straight to the result screen', async () => {
    renderConfirm(scanState(labelResult));

    expect(await screen.findByTestId('result-stub')).toHaveTextContent('null');
    expect(screen.queryByLabelText('Search dishes')).not.toBeInTheDocument();
  });

  it('sends "None of these" to the result with no dish', async () => {
    const user = userEvent.setup();
    renderConfirm(scanState(dishResult));

    await user.click(screen.getByRole('button', { name: 'None of these' }));

    expect(await screen.findByTestId('result-stub')).toHaveTextContent('null');
  });

  it('redirects home when opened without scan state', () => {
    renderConfirm();

    expect(screen.getByTestId('home')).toBeInTheDocument();
  });
});
