import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  'nutrition.servings_label': { en: 'Portions', bn: 'পরিবেশন' },
  'nutrition.servings_less': { en: 'Fewer portions', bn: 'কম পরিবেশন' },
  'nutrition.servings_more': { en: 'More portions', bn: 'বেশি পরিবেশন' },
  'nutrition.servings_hint': {
    en: 'One portion is the recipe estimate for one plate. This count also scales your shopping list.',
    bn: 'এক পরিবেশন মানে এক প্লেটের রেসিপি অনুমান। এই সংখ্যাটি আপনার শপিং লিস্টও বদলায়।',
  },
  'nutrition.basis_per_serving': { en: 'Per serving (estimated)', bn: 'প্রতি পরিবেশন (আনুমানিক)' },
  'nutrition.basis_for_servings': {
    en: 'For {servings} servings (estimated)',
    bn: '{servings} পরিবেশনের জন্য (আনুমানিক)',
  },
  'nutrition.coverage': { en: 'Data coverage: {percent}%', bn: 'তথ্য কভারেজ: {percent}%' },
  'nutrition.coverage_note': {
    en: 'A nutrient row appears only when at least {min}% of the dish weight has composition data; otherwise it reads not enough data, never zero.',
    bn: 'যে পুষ্টি সারির জন্য খাবারের ওজনের অন্তত {min}% অংশে উপাদানের তথ্য আছে, শুধু তখনই সেটি দেখা যায়; নাহলে তথ্য নেই লেখা থাকে, শূন্য নয়।',
  },
  'nutrition.about': {
    en: 'About these nutrition estimates',
    bn: 'এই পুষ্টি অনুমানগুলো সম্পর্কে',
  },
  'nutrition.about_body': {
    en: 'Every number here is an estimate, not a lab test of your plate. Ingredient values come from food-composition tables recorded per 100 g of raw ingredient and are scaled to the recipe amounts and to the portion you chose. Serving sizes and portion counts are estimates too. Rows with too little data are marked as not enough data instead of being shown as zero.',
    bn: 'এখানের প্রতিটি সংখ্যা একটি অনুমান, আপনার প্লেটের ল্যাব পরীক্ষা নয়। উপাদানের মান খাদ্য-উপাদান তালিকা থেকে নেওয়া, যা প্রতি ১০০ গ্রাম কাঁচা উপাদান হিসেবে রেকর্ড করা; সেগুলো রেসিপির পরিমাণ ও আপনার বেছে নেওয়া পরিবেশন অনুযায়ী হিসাব করা হয়। পরিবেশনের পরিমাণও আনুমানিক। যে সারিতে তথ্য খুব কম, সেটি শূন্য না দেখিয়ে তথ্য নেই লেখা থাকে।',
  },
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

/** Returns the card with a no-op portion stepper, the default one-portion view. */
function card(
  nutrition: NutritionResult | null,
  over: { servings?: number; onServingsChange?: (n: number) => void } = {},
) {
  return (
    <NutritionCard
      nutrition={nutrition}
      dish={null}
      servings={over.servings ?? 1}
      onServingsChange={over.onServingsChange ?? (() => {})}
    />
  );
}

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
    const { container } = wrap(card(unknownNutritionAnalysis.nutrition));

    expect(screen.getAllByText(NOT_ENOUGH)).toHaveLength(8);
    expect(container.textContent).not.toContain('758');
    expect(container.textContent).not.toContain('kcal');
  });

  it.each(fixtures)('shows the estimated badge for the %s fixture', (_name, nutrition) => {
    wrap(card(nutrition));

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

    wrap(card(labNutrition));

    expect(screen.getByText(/laboratory study of this dish/)).toBeInTheDocument();
  });

  it('shows the formatted value and unit for a nutrient that is shown', () => {
    wrap(card(kacchiNutrition));

    expect(screen.getByText('758')).toBeInTheDocument();
    expect(screen.getByText('31.2')).toBeInTheDocument();
    expect(screen.getAllByText('kcal')).toHaveLength(1);
  });

  it('states the data-coverage percentage and the gate that hides rows', () => {
    wrap(card(kacchiNutrition));

    expect(screen.getByText(/Data coverage: \d+%/)).toBeInTheDocument();
    expect(screen.getByText(/at least \d+% of the dish weight/)).toBeInTheDocument();
  });

  it('discloses how the estimates are made in the About section', async () => {
    const user = userEvent.setup();
    wrap(card(kacchiNutrition));

    await user.click(screen.getByRole('button', { name: 'About these nutrition estimates' }));

    expect(
      await screen.findByText(/Every number here is an estimate, not a lab test/),
    ).toBeInTheDocument();
  });

  it('scales the shown values by the selected portion count', () => {
    wrap(card(kacchiNutrition, { servings: 2 }));

    // The fixture stores 758.4 kcal per serving, shown as 758 at one portion.
    expect(screen.getByText('1517')).toBeInTheDocument();
    expect(screen.getByText('62.4')).toBeInTheDocument();
    expect(screen.getByText('For 2 servings (estimated)')).toBeInTheDocument();
    expect(screen.queryByText('758')).not.toBeInTheDocument();
  });

  it('calls onServingsChange with the next count from the stepper', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    wrap(card(kacchiNutrition, { onServingsChange: onChange }));

    await user.click(screen.getByRole('button', { name: 'More portions' }));

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('keeps hidden rows hidden when the portion count changes', () => {
    wrap(card(unknownNutritionAnalysis.nutrition, { servings: 3 }));

    expect(screen.getAllByText(NOT_ENOUGH)).toHaveLength(8);
    expect(screen.getByText('For 3 servings (estimated)')).toBeInTheDocument();
  });
});
