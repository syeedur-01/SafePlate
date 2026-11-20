import { NUTRIENT_KEYS, type Dish, type NutritionResult } from '@sp/contracts';
import { MIN_COVERAGE } from '@sp/engine';
import { useT } from '../i18n/i18n';
import { MAX_SERVINGS, MIN_SERVINGS } from '../lib/servings';
import { NUTRIENT_DISPLAY, formatNutrient } from '../lib/nutrient-format';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
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
  /** Selected portion count; the shown values are scaled from the per-serving estimate. */
  servings: number;
  /** Calls back when the portion stepper changes the count. */
  onServingsChange: (servings: number) => void;
}

/** Returns the estimated nutrition card that hides individual numbers below the coverage gate. */
export function NutritionCard({ nutrition, dish, servings, onServingsChange }: NutritionCardProps) {
  const { t } = useT();
  const result = nutrition ?? EMPTY_NUTRITION;
  const coveragePercent = Math.round(result.overallCoverage * 100);
  const minCoveragePercent = Math.round(MIN_COVERAGE * 100);
  // The card scales the engine's per-serving estimate by the chosen portion count.
  const scale = (value: number) => value * servings;

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
        role="group"
        aria-label={t('nutrition.servings_label')}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-soft p-3"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-heading">{t('nutrition.servings_label')}</p>
          <p className="text-xs leading-relaxed text-muted-fg">{t('nutrition.servings_hint')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="icon"
            aria-label={t('nutrition.servings_less')}
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
            aria-label={t('nutrition.servings_more')}
            disabled={servings >= MAX_SERVINGS}
            onClick={() => onServingsChange(servings + 1)}
          >
            +
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={coveragePercent}
          aria-label={t('nutrition.coverage', { percent: coveragePercent })}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${coveragePercent}%` }}
          />
        </div>
        <p className="text-xs text-muted-fg">
          {t('nutrition.coverage', { percent: coveragePercent })} ·{' '}
          {t('nutrition.coverage_note', { min: minCoveragePercent })}
        </p>
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
                  <span>{formatNutrient(key, scale(nutrient.value))}</span>
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

      <p className="text-xs font-medium text-heading">
        {servings === 1
          ? t('nutrition.basis_per_serving')
          : t('nutrition.basis_for_servings', { servings })}
      </p>

      <Accordion type="single" collapsible>
        <AccordionItem value="about">
          <AccordionTrigger>{t('nutrition.about')}</AccordionTrigger>
          <AccordionContent>{t('nutrition.about_body')}</AccordionContent>
        </AccordionItem>
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
