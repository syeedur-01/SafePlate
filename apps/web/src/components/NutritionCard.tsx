import { NUTRIENT_KEYS, type Dish, type NutritionResult } from '@sp/contracts';
import { useT } from '../i18n/i18n';
import { NUTRIENT_DISPLAY, formatNutrient } from '../lib/nutrient-format';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Badge } from './ui/badge';
import { StatusBadge } from './StatusBadge';

const HIDDEN_NUTRIENT: NutritionResult['perServing'][(typeof NUTRIENT_KEYS)[number]] = {
  value: null,
  coverage: 0,
  shown: false,
  origin: 'none',
};

const EMPTY_NUTRITION: NutritionResult = {
  perServing: {
    energy_kcal: HIDDEN_NUTRIENT,
    protein_g: HIDDEN_NUTRIENT,
    fat_g: HIDDEN_NUTRIENT,
    sat_fat_g: HIDDEN_NUTRIENT,
    carbs_g: HIDDEN_NUTRIENT,
    sugars_g: HIDDEN_NUTRIENT,
    fibre_g: HIDDEN_NUTRIENT,
    sodium_mg: HIDDEN_NUTRIENT,
  },
  overallCoverage: 0,
  missingIngredientIds: [],
  estimated: true,
};

export interface NutritionCardProps {
  nutrition: NutritionResult | null;
  dish: Dish | null;
}

/** Returns the estimated nutrition card that hides individual numbers below the coverage gate. */
export function NutritionCard({ nutrition, dish }: NutritionCardProps) {
  const { t } = useT();
  const result = nutrition ?? EMPTY_NUTRITION;
  const coveragePercent = Math.round(result.overallCoverage * 100);

  return (
    <section className="space-y-4 rounded-md border border-border p-4">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t('result.tab.nutrition')}</h2>
          <StatusBadge kind="estimated" />
        </div>
        {dish === null ? null : (
          <p className="text-xs text-muted-fg">
            {dish.serving_description} · about {dish.serving_weight_g} g (
            {t('badge.estimated').toLowerCase()})
          </p>
        )}
      </header>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={coveragePercent}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${coveragePercent}%` }} />
      </div>

      <ul className="divide-y divide-border">
        {NUTRIENT_KEYS.map((key) => {
          const display = NUTRIENT_DISPLAY[key];
          const nutrient = result.perServing[key];
          return (
            <li key={key} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>{t(display.labelKey)}</span>
              {nutrient.shown && nutrient.value !== null ? (
                <span className="flex items-center gap-2 font-semibold">
                  <span>{formatNutrient(key, nutrient.value)}</span>
                  <span className="font-normal text-muted-fg">{display.unit}</span>
                  {nutrient.origin === 'lab_scaled' ? (
                    <Badge variant="outline">{t('nutrition.from_lab_study')}</Badge>
                  ) : null}
                </span>
              ) : (
                <span className="text-xs text-muted-fg">{t('nutrition.not_enough_data')}</span>
              )}
            </li>
          );
        })}
      </ul>

      <Accordion type="single" collapsible>
        <AccordionItem value="why-missing">
          <AccordionTrigger>{t('nutrition.why_missing')}</AccordionTrigger>
          <AccordionContent>
            {result.missingIngredientIds.length === 0 ? null : (
              <ul className="list-disc space-y-1 pl-5 text-xs">
                {result.missingIngredientIds.map((id) => (
                  <li key={id}>{id.replaceAll('-', ' ')}</li>
                ))}
              </ul>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <p className="text-xs text-muted-fg">{t('nutrition.estimate_note')}</p>
    </section>
  );
}
