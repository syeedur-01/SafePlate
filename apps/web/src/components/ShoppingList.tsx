import { useState } from 'react';
import type { AnalysisResult } from '@sp/contracts';
import { useT } from '../i18n/i18n';
import { MAX_SERVINGS, MIN_SERVINGS } from '../lib/servings';
import { Button } from './ui/button';

export interface ShoppingListProps {
  items: AnalysisResult['shoppingList'];
  ingredientNames: Record<string, string>;
  servings: number;
  onServingsChange: (servings: number) => void;
}

/** Returns the shopping list with a servings stepper, checkable rows, a select-all toggle and a copy button. */
export function ShoppingList({
  items,
  ingredientNames,
  servings,
  onServingsChange,
}: ShoppingListProps) {
  const { t } = useT();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [manualText, setManualText] = useState<string | null>(null);

  const name = (item: AnalysisResult['shoppingList'][number]) =>
    ingredientNames[item.ingredientId] ?? item.ingredientId;
  const plainText = items.map((item) => `${name(item)}: ${item.grams}g`).join('\n');
  const allChecked = items.length > 0 && items.every((item) => checked[item.ingredientId] === true);

  async function copy() {
    const clipboard = navigator.clipboard;
    if (clipboard === undefined) {
      setManualText(plainText);
      return;
    }
    try {
      await clipboard.writeText(plainText);
    } catch {
      setManualText(plainText);
    }
  }

  function toggleAll() {
    const next = !allChecked;
    setChecked(Object.fromEntries(items.map((item) => [item.ingredientId, next])));
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="icon"
          disabled={servings <= MIN_SERVINGS}
          onClick={() => onServingsChange(servings - 1)}
        >
          -
        </Button>
        <span aria-live="polite" className="min-w-6 text-center font-semibold">
          {servings}
        </span>
        <Button
          variant="secondary"
          size="icon"
          disabled={servings >= MAX_SERVINGS}
          onClick={() => onServingsChange(servings + 1)}
        >
          +
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-heading">{t('shopping.title')}</span>
        <Button variant="ghost" size="sm" onClick={toggleAll} disabled={items.length === 0}>
          {t(allChecked ? 'shopping.deselect_all' : 'shopping.select_all')}
        </Button>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.ingredientId}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked[item.ingredientId] ?? false}
                onChange={(event) =>
                  setChecked((current) => ({
                    ...current,
                    [item.ingredientId]: event.target.checked,
                  }))
                }
              />
              <span>{name(item)}</span>
              <span className="ml-auto tabular-nums text-fg/70">{item.grams} g</span>
            </label>
          </li>
        ))}
      </ul>

      <Button variant="secondary" className="w-full" onClick={copy}>
        {t('shopping.copy')}
      </Button>

      {manualText === null ? null : (
        <textarea
          aria-label={t('shopping.copy')}
          readOnly
          value={manualText}
          className="min-h-24 w-full rounded-md border border-border bg-card p-2 text-sm"
        />
      )}
    </section>
  );
}
