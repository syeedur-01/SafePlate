import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { I18nProvider, registerMessages } from '../src/i18n/i18n';
import { ForYouCard } from '../src/components/ForYouCard';
import type { IngredientBreakdown } from '../src/lib/ingredient-breakdown';
import { kacchiAnalysis } from '../src/fixtures/analysis-kacchi';

registerMessages({
  'warn.allergen_present': {
    en: 'This dish contains {allergen} and may not suit you.',
    bn: 'এই খাবারে {allergen} আছে, যা আপনার জন্য উপযোগী নাও হতে পারে।',
  },
  'warn.hypertension_sodium': {
    en: 'This dish provides about {percent}% of the daily {nutrient} level suggested for people with high blood pressure. Consider limiting how much you eat.',
    bn: 'উচ্চ রক্তচাপে দৈনিক {nutrient} সীমার প্রায় {percent}% এই খাবারে রয়েছে।',
  },
  'warn.diabetes_sodium': {
    en: 'This dish provides about {percent}% of the daily {nutrient} level suggested for people with diabetes. Consider limiting how much you eat.',
    bn: 'ডায়াবেটিসে দৈনিক {nutrient} সীমার প্রায় {percent}% এই খাবারে রয়েছে।',
  },
  'warning.level.avoid': { en: 'Avoid', bn: 'এড়িয়ে চলুন' },
  'warning.level.caution': { en: 'Caution', bn: 'সতর্ক থাকুন' },
  'warning.level.info': { en: 'Info', bn: 'তথ্য' },
  'allergen.milk': { en: 'Milk', bn: 'দুধ' },
  'nutrient.sodium_mg': { en: 'Sodium', bn: 'সোডিয়াম' },
  'nutrient.energy_kcal': { en: 'Energy', bn: 'শক্তি' },
  'nutrient.protein_g': { en: 'Protein', bn: 'প্রোটিন' },
  'nutrient.fat_g': { en: 'Fat', bn: 'চর্বি' },
  'badge.estimated': { en: 'estimated', bn: 'আনুমানিক' },
  'evidence.source': { en: 'Source', bn: 'উৎস' },
  'foryou.none': {
    en: 'No warnings for this dish with your current profile.',
    bn: 'আপনার বর্তমান প্রোফাইল অনুযায়ী কোনো সতর্কতা নেই।',
  },
  'foryou.add_profile': {
    en: 'Set up your health profile to get warnings that fit you.',
    bn: 'আপনার উপযোগী সতর্কবার্তা পেতে স্বাস্থ্য প্রোফাইল তৈরি করুন।',
  },
  'nav.settings': { en: 'Settings', bn: 'সেটিংস' },
  'foryou.personalized.title': { en: 'For your profile', bn: 'আপনার প্রোফাইলের জন্য' },
  'foryou.ingredients.title': { en: 'What is in this dish', bn: 'এই খাবারে যা আছে' },
  'foryou.ingredients.note': {
    en: 'Ingredient amounts are estimates from the recipe.',
    bn: 'উপাদানের পরিমাণ রেসিপি অনুযায়ী আনুমানিক।',
  },
  'foryou.general.title': { en: 'Good to know for everyone', bn: 'সবার জন্য জানার মতো' },
  'foryou.general.allergens': { en: 'This dish contains:', bn: 'এই খাবারে আছে:' },
  'foryou.general.noAllergens': {
    en: 'No allergens are listed in its recipe or label.',
    bn: 'এর রেসিপি বা লেবেলে কোনো অ্যালার্জেনের তালিকা নেই।',
  },
  'foryou.general.gap': {
    en: 'SafePlate does not set general nutrient limits for everyone yet.',
    bn: 'SafePlate এখনো সবার জন্য সাধারণ পুষ্টি সীমা নির্ধারণ করে না।',
  },
  'foryou.sources.title': {
    en: 'Where these numbers come from',
    bn: 'এই সংখ্যাগুলো এসেছে কোথা থেকে',
  },
});

const wrap = (ui: ReactElement) =>
  render(
    <MemoryRouter>
      <I18nProvider lang="en">{ui}</I18nProvider>
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
});

describe('ForYouCard', () => {
  it('shows the allergen warning before an avoid warning before a caution warning', () => {
    wrap(<ForYouCard warnings={[...kacchiAnalysis.warnings].reverse()} hasProfile />);
    const items = screen.getAllByRole('listitem').map((item) => item.textContent ?? '');
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('contains Milk');
    expect(items[1]).toContain('74%');
    expect(items[2]).toContain('55%');
  });

  it('conveys the level with a word, not only a colour', () => {
    wrap(<ForYouCard warnings={kacchiAnalysis.warnings} hasProfile />);
    expect(screen.getAllByText('Avoid').length).toBeGreaterThan(0);
    expect(screen.getByText('Caution')).toBeInTheDocument();
  });

  it('shows a source chip only where a source exists', () => {
    wrap(<ForYouCard warnings={kacchiAnalysis.warnings} hasProfile />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.textContent).not.toContain('Source');
    expect(items[1]?.textContent).toContain('Source');
  });

  it('says nothing applies when the profile is set and there are no warnings', () => {
    wrap(<ForYouCard warnings={[]} hasProfile />);
    expect(
      screen.getByText('No warnings for this dish with your current profile.'),
    ).toBeInTheDocument();
  });

  it('invites the user to add a profile when there is none', () => {
    wrap(<ForYouCard warnings={[]} hasProfile={false} />);
    expect(
      screen.getByText('Set up your health profile to get warnings that fit you.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/settings');
  });

  it('shows an ingredient breakdown with per-100 g values and dashes for nulls', () => {
    const breakdown: IngredientBreakdown = {
      rows: [
        {
          ingredientId: 'white-rice',
          name: 'White rice',
          grams: 150,
          estimated: false,
          values: [
            { key: 'energy_kcal', value: 345 },
            { key: 'protein_g', value: 6.6 },
            { key: 'fat_g', value: 0.3 },
            { key: 'sodium_mg', value: null },
          ],
        },
      ],
      sources: [
        {
          sourceName: 'Food Composition Table for Bangladesh',
          publisher: 'INFS, Dhaka',
          year: 2013,
          url: 'https://example.org/fctb.pdf',
        },
      ],
    };
    wrap(<ForYouCard warnings={[]} hasProfile breakdown={breakdown} allergens={[]} />);

    expect(screen.getByText('What is in this dish')).toBeInTheDocument();
    expect(screen.getByText('White rice')).toBeInTheDocument();
    expect(screen.getByText('150 g')).toBeInTheDocument();
    expect(screen.getByText('345 kcal')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('0 mg')).not.toBeInTheDocument();
    expect(
      screen.getByText('Ingredient amounts are estimates from the recipe.'),
    ).toBeInTheDocument();

    expect(screen.getByText('Good to know for everyone')).toBeInTheDocument();
    expect(screen.getByText('No allergens are listed in its recipe or label.')).toBeInTheDocument();
    expect(
      screen.getByText('SafePlate does not set general nutrient limits for everyone yet.'),
    ).toBeInTheDocument();

    expect(screen.getByText('Where these numbers come from')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Food Composition Table/ })).toHaveAttribute(
      'href',
      'https://example.org/fctb.pdf',
    );
  });

  it('names declared allergens in the general section', () => {
    const breakdown: IngredientBreakdown = { rows: [], sources: [] };
    wrap(<ForYouCard warnings={[]} hasProfile breakdown={breakdown} allergens={['milk']} />);
    expect(screen.getByText(/Milk/)).toBeInTheDocument();
  });
});
