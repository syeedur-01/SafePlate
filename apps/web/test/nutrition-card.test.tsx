import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { NutritionResult } from '@sp/contracts';
import { I18nProvider, registerMessages } from '../src/i18n/i18n';
import { NutritionCard } from '../src/components/NutritionCard';
import { kacchiAnalysis } from '../src/fixtures/analysis-kacchi';
import { labelAnalysis } from '../src/fixtures/analysis-label';
import { unknownNutritionAnalysis } from '../src/fixtures/analysis-unknown-nutrition';

const NOT_ENOUGH = 'Not enough data for a reliable estimate.';

registerMessages({
  'result.tab.nutrition': { en: 'Nutrition', bn: 'পুষ্টি' },
  'nutrition.not_enough_data': { en: NOT_ENOUGH, bn: 'নির্ভরযোগ্য অনুমানের জন্য যথেষ্ট তথ্য নেই।' },
  'nutrition.estimate_note': {
    en: 'All nutrition numbers are estimates from food-composition tables.',
    bn: 'পুষ্টির সব সংখ্যা খাদ্য উপাদান তালিকা থেকে নেওয়া অনুমান।',
  },
  'nutrition.from_lab_study': {
    en: 'Based on a laboratory study of this dish, scaled to the serving size (estimate).',
    bn: 'এই খাবারের ওপর পরীক্ষাগারে করা একটি গবেষণার ভিত্তিতে হিসাব করা (আনুমানিক)।',
  },
  'nutrition.why_missing': { en: 'Why is some data missing?', bn: 'কিছু তথ্য কেন নেই?' },
  'badge.estimated': { en: 'Estimated', bn: 'আনুমানিক' },
  'nutrient.energy_kcal': { en: 'Energy', bn: 'খাদ্যশক্তি' },
  'nutrient.protein_g': { en: 'Protein', bn: 'প্রোটিন' },
  'nutrient.fat_g': { en: 'Fat', bn: 'চর্বি' },
  'nutrient.sat_fat_g': { en: 'Saturated fat', bn: 'সম্পৃক্ত চর্বি' },
  'nutrient.carbs_g': { en: 'Carbohydrates', bn: 'কার্বোহাইড্রেট' },
  'nutrient.sugars_g': { en: 'Sugars', bn: 'চিনি' },
  'nutrient.fibre_g': { en: 'Fibre', bn: 'খাদ্য আঁশ' },
  'nutrient.sodium_mg': { en: 'Sodium', bn: 'সোডিয়াম' },
});

const wrap = (ui: ReactElement) => render(<I18nProvider lang="en">{ui}</I18nProvider>);

afterEach(() => {
  cleanup();
});

const kacchiNutrition = kacchiAnalysis.nutrition;
if (kacchiNutrition === null) throw new Error('kacchi fixture must include nutrition');

const fixtures: Array<[string, NutritionResult | null]> = [
  ['kacchi dish', kacchiAnalysis.nutrition],
  ['label', labelAnalysis.nutrition],
  ['unknown nutrition', unknownNutritionAnalysis.nutrition],
];

describe('NutritionCard', () => {
  it('renders no nutrient numbers and the not-enough-data text for every row when all values are hidden', () => {
    const { container } = wrap(
      <NutritionCard nutrition={unknownNutritionAnalysis.nutrition} dish={null} />,
    );

    expect(screen.getAllByText(NOT_ENOUGH)).toHaveLength(8);
    expect(container.textContent).not.toContain('758');
    expect(container.textContent).not.toContain('kcal');
  });

  it.each(fixtures)('shows the estimated badge for the %s fixture', (_name, nutrition) => {
    wrap(<NutritionCard nutrition={nutrition} dish={null} />);

    expect(screen.getByText('Estimated')).toBeInTheDocument();
  });

  it('marks a lab-scaled nutrient with the laboratory-study tag', () => {
    const labNutrition: NutritionResult = {
      ...kacchiNutrition,
      perServing: {
        ...kacchiNutrition.perServing,
        energy_kcal: { value: 500, coverage: 1, shown: true, origin: 'lab_scaled' },
      },
    };

    wrap(<NutritionCard nutrition={labNutrition} dish={null} />);

    expect(screen.getByText(/laboratory study of this dish/)).toBeInTheDocument();
  });

  it('shows the formatted value and unit for a nutrient that is shown', () => {
    wrap(<NutritionCard nutrition={kacchiNutrition} dish={null} />);

    expect(screen.getByText('758')).toBeInTheDocument();
    expect(screen.getByText('31.2')).toBeInTheDocument();
    expect(screen.getAllByText('kcal')).toHaveLength(1);
  });
});
