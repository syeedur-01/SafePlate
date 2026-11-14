import { useState } from 'react';
import type { AnalysisResult } from '@sp/contracts';
import { Button } from './ui/button';

export interface ShoppingListProps {
  items: AnalysisResult['shoppingList'];
  ingredientNames: Record<string, string>;
  servings: number;
  onServingsChange: (servings: number) => void;
}

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 10;

/** Returns the shopping list with a servings stepper, checkable rows and a copy button. */
export function ShoppingList({
  items,
  ingredientNames,
  servings,
  onServingsChange,
}: ShoppingListProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [manualText, setManualText] = useState<string | null>(null);

  const name = (item: AnalysisResult['shoppingList'][number]) =>
    ingredientNames[item.ingredientId] ?? item.ingredientId;
  const plainText = items.map((item) => `${name(item)}: ${item.grams}g`).join('\n');

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
        Copy list
      </Button>

      {manualText === null ? null : (
        <textarea
          aria-label="Copy list"
          readOnly
          value={manualText}
          className="min-h-24 w-full rounded-md border border-border bg-card p-2 text-sm"
        />
      )}
    </section>
  );
}
