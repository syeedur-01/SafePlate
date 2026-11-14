import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { I18nProvider, registerMessages } from '../src/i18n/i18n';
import { ForYouCard } from '../src/components/ForYouCard';
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
});
