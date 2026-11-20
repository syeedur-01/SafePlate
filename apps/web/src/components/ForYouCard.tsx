import { AlertTriangle, Info, ShieldAlert, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Allergen, Warning } from '@sp/contracts';
import { useT, type TranslateParams } from '../i18n/i18n';
import { cn } from '../lib/cn';
import type { IngredientBreakdown } from '../lib/ingredient-breakdown';
import { NUTRIENT_DISPLAY, formatNutrient } from '../lib/nutrient-format';
import { Badge } from './ui/badge';
import { StatusBadge } from './StatusBadge';

const LEVEL_RANK: Record<Warning['level'], number> = { avoid: 0, caution: 1, info: 2 };

const LEVEL_ICON: Record<Warning['level'], LucideIcon> = {
  avoid: ShieldAlert,
  caution: AlertTriangle,
  info: Info,
};

export interface ForYouCardProps {
  warnings: Warning[];
  hasProfile: boolean;
  /** Allergens declared by the recipe or the scanned label: general info, valid for everyone. */
  allergens?: Allergen[];
  /** Prepared ingredient rows and composition sources; absent for label scans. */
  breakdown?: IngredientBreakdown | null;
}

/** Returns the For You card: personalized warnings first, then ingredient-level and general info. */
export function ForYouCard({ warnings, hasProfile, allergens, breakdown }: ForYouCardProps) {
  const { t } = useT();

  const rank = (warning: Warning) => (warning.kind === 'allergen' ? -1 : LEVEL_RANK[warning.level]);
  const sorted = [...warnings].sort((a, b) => rank(a) - rank(b));

  function params(warning: Warning): TranslateParams {
    const out: TranslateParams = { ...warning.params };
    if (typeof warning.params.allergen === 'string') {
      out.allergen = t(`allergen.${warning.params.allergen}`);
    }
    if (typeof warning.params.nutrient === 'string') {
      out.nutrient = t(`nutrient.${warning.params.nutrient}`);
    }
    return out;
  }

  return (
    <section className="space-y-6">
      {warnings.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-soft p-4 text-sm">
          {hasProfile ? (
            <p>{t('foryou.none')}</p>
          ) : (
            <p>
              {t('foryou.add_profile')}{' '}
              <Link className="font-semibold text-primary underline" to="/settings">
                {t('nav.settings')}
              </Link>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-heading">{t('foryou.personalized.title')}</h3>
          <ul className="space-y-3">
            {sorted.map((warning) => {
              const Icon = LEVEL_ICON[warning.level];
              return (
                <li
                  key={warning.id}
                  className={cn(
                    'space-y-2 rounded-xl border border-border bg-card p-3 text-sm shadow-sm',
                    warning.kind === 'allergen' && 'border-2 border-risk-high',
                  )}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    <span>{t(`warning.level.${warning.level}`)}</span>
                  </div>
                  <p>{t(warning.messageKey, params(warning))}</p>
                  {warning.sourceRef === null ? null : (
                    <Badge
                      variant="outline"
                      title={warning.sourceRef}
                      aria-label={`${t('evidence.source')}: ${warning.sourceRef}`}
                    >
                      {t('evidence.source')}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {breakdown ? (
        <section aria-labelledby="foryou-ingredients" className="space-y-3">
          <h3
            id="foryou-ingredients"
            className="flex flex-wrap items-center gap-2 text-sm font-semibold text-heading"
          >
            {t('foryou.ingredients.title')}
            <StatusBadge kind="estimated" />
          </h3>
          <p className="text-xs leading-relaxed text-muted-fg">{t('foryou.ingredients.note')}</p>
          <ul className="space-y-2">
            {breakdown.rows.map((row) => (
              <li
                key={row.ingredientId}
                className="rounded-xl border border-border bg-surface-soft p-3 text-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-heading">{row.name}</span>
                  <span className="shrink-0 tabular-nums text-xs text-muted-fg">{row.grams} g</span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                  {row.values.map(({ key, value }) => {
                    const display = NUTRIENT_DISPLAY[key];
                    return (
                      <div key={key} className="flex items-baseline justify-between gap-2 sm:block">
                        <dt className="text-xs text-muted-fg">{t(display.labelKey)}</dt>
                        <dd className="tabular-nums text-xs font-medium">
                          {value === null ? '—' : `${formatNutrient(key, value)} ${display.unit}`}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {allergens !== undefined ? (
        <section aria-labelledby="foryou-general" className="space-y-2">
          <h3 id="foryou-general" className="text-sm font-semibold text-heading">
            {t('foryou.general.title')}
          </h3>
          <p className="text-sm">
            {allergens.length === 0
              ? t('foryou.general.noAllergens')
              : `${t('foryou.general.allergens')} ${allergens
                  .map((allergen) => t(`allergen.${allergen}`))
                  .join(', ')}`}
          </p>
          <p
            role="note"
            className="rounded-xl bg-surface-soft px-3 py-2 text-xs leading-relaxed text-muted-fg"
          >
            {t('foryou.general.gap')}
          </p>
        </section>
      ) : null}

      {breakdown && breakdown.sources.length > 0 ? (
        <section aria-labelledby="foryou-sources" className="space-y-2">
          <h3 id="foryou-sources" className="text-sm font-semibold text-heading">
            {t('foryou.sources.title')}
          </h3>
          <ul className="space-y-1">
            {breakdown.sources.map((source) => (
              <li
                key={`${source.sourceName}|${source.year ?? ''}`}
                className="text-xs text-muted-fg"
              >
                {source.url === null ? (
                  source.sourceName
                ) : (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium text-primary underline"
                  >
                    {source.sourceName}
                  </a>
                )}
                {source.publisher === null ? null : ` — ${source.publisher}`}
                {source.year === null ? null : ` (${source.year})`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
