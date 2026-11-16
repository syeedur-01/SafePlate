import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, renderHook } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { DishScanResult, LabelScanResult } from '@sp/contracts';
import { AnalysisResultSchema, NormalizedDishesFileSchema } from '@sp/contracts';
import { makeProfile } from '@sp/contracts/testing';
import normalizedDishesFile from '@sp/knowledge/data/normalized/dishes.json';
import { I18nProvider } from '../src/i18n/i18n';
import { Result } from '../src/pages/Result';
import { LocalProfileStore, type ProfileStorage } from '../src/state/profile-store';
import { useAnalysis } from '../src/state/useAnalysis';

const NOW = () => new Date('2026-10-26T09:30:00.000Z');

const OBSERVATIONS = { spoilageSigns: [], imageQuality: 'good' as const, notes: '' };

function dishScan(dishId: string): DishScanResult {
  return {
    kind: 'dish',
    candidates: [{ dishId, label: dishId, confidence: 0.9 }],
    observations: OBSERVATIONS,
    provider: 'mock',
    cached: false,
  };
}

const LABEL_SCAN: LabelScanResult = {
  kind: 'label',
  productName: 'Milk biscuit',
  ingredientsText: null,
  declaredAllergens: ['milk'],
  expiryDate: null,
  nutritionPer100g: null,
  observations: OBSERVATIONS,
  provider: 'mock',
  cached: false,
};

describe('useAnalysis', () => {
  it('returns a valid result without allergen warnings for an empty profile', () => {
    const { result } = renderHook(() =>
      useAnalysis({
        scanResult: dishScan('kacchi-biryani'),
        dishId: 'kacchi-biryani',
        servings: 1,
        profile: makeProfile(),
        now: NOW,
      }),
    );

    expect(AnalysisResultSchema.safeParse(result.current).success).toBe(true);
    expect(result.current.warnings.filter((warning) => warning.kind === 'allergen')).toEqual([]);
  });

  it('puts the allergen warning first when the dish lists an allergen the profile avoids', () => {
    const dishes = NormalizedDishesFileSchema.parse(normalizedDishesFile).dishes;
    const milkDish = dishes.find((dish) => dish.allergens.includes('milk'));
    expect(milkDish).toBeDefined();
    if (milkDish === undefined) {
      throw new Error('Test expects at least one real dish that lists milk');
    }

    const { result } = renderHook(() =>
      useAnalysis({
        scanResult: dishScan(milkDish.id),
        dishId: milkDish.id,
        servings: 1,
        profile: makeProfile({ allergies: ['milk'] }),
        now: NOW,
      }),
    );

    expect(result.current.warnings[0]?.kind).toBe('allergen');
  });

  it('puts the allergen warning first for a label that declares milk', () => {
    const { result } = renderHook(() =>
      useAnalysis({
        scanResult: LABEL_SCAN,
        dishId: null,
        servings: 1,
        profile: makeProfile({ allergies: ['milk'] }),
        now: NOW,
      }),
    );

    expect(result.current.warnings[0]?.kind).toBe('allergen');
    expect(result.current.warnings[0]?.allergen).toBe('milk');
  });

  it('doubles every shopping-list gram value when servings goes from 1 to 2', () => {
    const profile = makeProfile();
    const { result, rerender } = renderHook(
      ({ servings }: { servings: number }) =>
        useAnalysis({
          scanResult: dishScan('beef-tehari'),
          dishId: 'beef-tehari',
          servings,
          profile,
          now: NOW,
        }),
      { initialProps: { servings: 1 } },
    );

    const single = result.current.shoppingList;
    expect(single.length).toBeGreaterThan(0);

    rerender({ servings: 2 });

    expect(result.current.shoppingList).toHaveLength(single.length);
    for (const item of single) {
      const doubled = result.current.shoppingList.find(
        (candidate) => candidate.ingredientId === item.ingredientId,
      );
      expect(doubled?.grams).toBeCloseTo(item.grams * 2, 5);
    }
  });
});

function memoryStorage(): ProfileStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function renderResultPage(profileStore: LocalProfileStore) {
  render(
    <I18nProvider lang="en">
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/result',
            state: {
              scanResult: dishScan('kacchi-biryani'),
              dishId: 'kacchi-biryani',
              thumbDataUrl: null,
            },
          },
        ]}
      >
        <Routes>
          <Route path="/result" element={<Result profileStore={profileStore} />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('result analysis privacy', () => {
  afterEach(() => {
    cleanup();
  });

  it('makes no network call during analysis', async () => {
    const profileStore = new LocalProfileStore(memoryStorage());
    profileStore.save(makeProfile({ conditions: ['hypertension', 'diabetes'] }));

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn();
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
    const openSpy = vi.spyOn(XMLHttpRequest.prototype, 'open');

    renderResultPage(profileStore);

    expect(await screen.findByRole('tab', { name: 'Safety' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: originalFetch,
    });
  });
});
