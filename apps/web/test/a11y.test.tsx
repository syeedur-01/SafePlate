import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { DishScanResult } from '@sp/contracts';
import { getMessages } from '@sp/knowledge';
import { I18nProvider, registerMessages } from '../src/i18n/i18n';
import { History } from '../src/pages/History';
import { Onboarding } from '../src/pages/Onboarding';
import { Result } from '../src/pages/Result';
import { HistoryStore, type HistoryStorage } from '../src/state/history-store';
import { LocalProfileStore } from '../src/state/profile-store';

registerMessages(getMessages());

const CLOCK = '2026-10-25T12:00:00.000Z';

const KACCHI_SCAN: DishScanResult = {
  kind: 'dish',
  candidates: [{ dishId: 'kacchi-biryani', label: 'Kacchi Biryani', confidence: 0.82 }],
  observations: { spoilageSigns: [], imageQuality: 'good', notes: '' },
  provider: 'mock',
  cached: false,
};

/** Returns an in-memory storage that never touches the network or the real localStorage. */
function mem(): HistoryStorage & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}

/** Returns the accessible name an assistive technology would read for the element. */
function accessibleName(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel !== null && ariaLabel.trim() !== '') {
    return ariaLabel.trim();
  }
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy !== null) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
    if (text !== '') {
      return text;
    }
  }
  const text = (el.textContent ?? '').trim();
  if (text !== '') {
    return text;
  }
  const title = el.getAttribute('title');
  return title === null ? '' : title.trim();
}

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

describe('accessibility', () => {
  it('gives every button and link on the Result page an accessible name', async () => {
    const user = userEvent.setup();
    renderResultPage();

    // Visit every tab so the controls in each panel are mounted before checking.
    for (const name of ['For you', 'Nutrition', 'Swap and shopping']) {
      await user.click(screen.getByRole('tab', { name }));
    }

    const controls = Array.from(document.querySelectorAll('button, a'));
    expect(controls.length).toBeGreaterThan(0);
    const unnamed = controls
      .filter((el) => accessibleName(el) === '')
      .map((el) => el.outerHTML.slice(0, 120));
    expect(unnamed).toEqual([]);
  });

  it('gives every image an alt attribute on the History page', () => {
    const store = new HistoryStore(mem());
    store.add({
      id: '2026-10-25:kacchi-biryani',
      at: CLOCK,
      dishId: 'kacchi-biryani',
      title: 'Kacchi Biryani',
      score: 42,
      level: 'moderate',
      thumb: 'data:image/png;base64,AAAA',
    });

    render(
      <I18nProvider lang="en">
        <History store={store} />
      </I18nProvider>,
    );

    const images = Array.from(document.querySelectorAll('img'));
    expect(images.length).toBeGreaterThan(0);
    expect(images.filter((img) => img.getAttribute('alt') === null)).toEqual([]);
  });

  it('makes every form control in Onboarding reachable by its label', async () => {
    const user = userEvent.setup();
    const store = new LocalProfileStore(mem());
    render(
      <I18nProvider lang="en">
        <Onboarding store={store} now={() => CLOCK} onDone={() => {}} />
      </I18nProvider>,
    );

    // The form lives behind the landing's "Create Your Profile" choice.
    await user.click(screen.getByRole('button', { name: /Create Your Profile/ }));

    const controls = Array.from(document.querySelectorAll('input'));
    expect(controls.length).toBeGreaterThan(5);

    const failures: string[] = [];
    for (const control of controls) {
      const name = control.closest('label')?.textContent?.trim() ?? '';
      if (name === '') {
        failures.push(`no wrapping label: ${control.outerHTML.slice(0, 80)}`);
        continue;
      }
      let found: HTMLElement | null = null;
      try {
        found = screen.getByLabelText(name);
      } catch {
        found = null;
      }
      if (found !== control) {
        failures.push(`label does not resolve to its control: ${name}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('conveys the safety level and the nutrition status in words, not colour alone', async () => {
    const user = userEvent.setup();
    renderResultPage();

    const gauge = screen.getByRole('img');
    const name = gauge.getAttribute('aria-label') ?? '';
    expect(name).toMatch(/:\s*\d+\/100$/);
    const levelWord = name.split(':')[0]?.trim() ?? '';
    expect(levelWord).not.toBe('');
    // The same level word is rendered visibly next to the gauge.
    expect(screen.getByText(levelWord)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Nutrition' }));
    expect(await screen.findByText('Estimated')).toBeInTheDocument();
  });
});
