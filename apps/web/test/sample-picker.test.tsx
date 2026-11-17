import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../src/i18n/i18n';
import { SamplePicker } from '../src/components/SamplePicker';

function Layout() {
  return (
    <>
      <SamplePicker />
      <Outlet />
    </>
  );
}

function renderPicker() {
  render(
    <I18nProvider lang="en">
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<p>scan screen</p>} />
            <Route path="/confirm" element={<p>confirm screen</p>} />
            <Route path="/result" element={<p>result screen</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function namePattern(name: string): RegExp {
  return new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

describe('SamplePicker', () => {
  it.each([
    ['Kacchi Biryani', 'confirm screen'],
    ['Mishti Doi (spoiled)', 'confirm screen'],
    ['Unknown dish', 'confirm screen'],
    ['Label: snack', 'result screen'],
  ])('navigates %s to the flow start', async (name, destination) => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: namePattern(name) }));

    expect(await screen.findByText(destination)).toBeInTheDocument();
  });

  it('marks every sample as no AI call', () => {
    renderPicker();

    expect(screen.getAllByText('Sample, no AI call')).toHaveLength(4);
  });

  it('never calls fetch', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderPicker();

    for (const name of ['Kacchi Biryani', 'Mishti Doi (spoiled)', 'Unknown dish', 'Label: snack']) {
      await user.click(screen.getByRole('button', { name: namePattern(name) }));
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
