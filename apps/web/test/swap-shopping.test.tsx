import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { I18nProvider, registerMessages } from '../src/i18n/i18n';
import { SwapList } from '../src/components/SwapList';
import { ShoppingList } from '../src/components/ShoppingList';
import { kacchiAnalysis } from '../src/fixtures/analysis-kacchi';

registerMessages({
  'swap.lower_nutrient': {
    en: 'Suggested because it is lower in {nutrient}.',
    bn: 'এতে {nutrient} কম, তাই এটি প্রস্তাব করা হয়েছে।',
  },
  'swap.none': {
    en: 'No alternative dish was found that is lower in the flagged nutrients and has no warnings for your profile.',
    bn: 'কোনো বিকল্প খাবার পাওয়া যায়নি।',
  },
  'nutrient.sodium_mg': { en: 'Sodium', bn: 'সোডিয়াম' },
});

const wrap = (ui: ReactElement) => render(<I18nProvider lang="en">{ui}</I18nProvider>);

const dishNames = {
  'bhapa-pitha': 'Bhapa Pitha',
  'chitoi-pitha': 'Chitoi Pitha',
  'begun-bhaja': 'Begun Bhaja',
  'extra-dish': 'Extra Dish',
};

const items = [
  { ingredientId: 'mutton', grams: 120 },
  { ingredientId: 'rice', grams: 100 },
];

const ingredientNames = { mutton: 'Mutton', rice: 'White rice' };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SwapList', () => {
  it('renders up to three alternatives with their improved nutrients as chips', () => {
    const swaps = [
      ...kacchiAnalysis.swaps,
      { dishId: 'extra-dish', improves: ['sodium_mg' as const], reasonKey: 'swap.lower_nutrient' },
    ];
    wrap(<SwapList swaps={swaps} dishNames={dishNames} />);

    expect(screen.getByText('Bhapa Pitha')).toBeInTheDocument();
    expect(screen.getByText('Chitoi Pitha')).toBeInTheDocument();
    expect(screen.getByText('Begun Bhaja')).toBeInTheDocument();
    expect(screen.queryByText('Extra Dish')).not.toBeInTheDocument();
    expect(screen.getAllByText('Sodium')).toHaveLength(3);
    expect(screen.getAllByText('Suggested because it is lower in Sodium.')).toHaveLength(3);
  });

  it('shows the empty state when there is nothing better to suggest', () => {
    wrap(<SwapList swaps={[]} dishNames={dishNames} />);
    expect(screen.getByText(/No alternative dish was found/)).toBeInTheDocument();
  });
});

describe('ShoppingList', () => {
  it('calls onServingsChange with 2 after one click on +', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    wrap(
      <ShoppingList
        items={items}
        ingredientNames={ingredientNames}
        servings={1}
        onServingsChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: '+' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('never goes below 1 or above 10', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const tree = (servings: number) => (
      <I18nProvider lang="en">
        <ShoppingList
          items={items}
          ingredientNames={ingredientNames}
          servings={servings}
          onServingsChange={onChange}
        />
      </I18nProvider>
    );
    const { rerender } = render(tree(1));

    await user.click(screen.getByRole('button', { name: '-' }));
    expect(onChange).not.toHaveBeenCalled();

    rerender(tree(10));
    await user.click(screen.getByRole('button', { name: '+' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('copies the list as one name-and-grams line per item', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    wrap(
      <ShoppingList
        items={items}
        ingredientNames={ingredientNames}
        servings={1}
        onServingsChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy list' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Mutton: 120g\nWhite rice: 100g'));
  });

  it('shows the text in a selectable box when the clipboard is unavailable', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    wrap(
      <ShoppingList
        items={items}
        ingredientNames={ingredientNames}
        servings={1}
        onServingsChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy list' }));

    expect(screen.getByRole('textbox', { name: 'Copy list' })).toHaveValue(
      'Mutton: 120g\nWhite rice: 100g',
    );
  });
});
