import { AlertTriangle, Info, ShieldAlert, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Warning } from '@sp/contracts';
import { useT, type TranslateParams } from '../i18n/i18n';
import { cn } from '../lib/cn';
import { Badge } from './ui/badge';

const LEVEL_RANK: Record<Warning['level'], number> = { avoid: 0, caution: 1, info: 2 };

const LEVEL_ICON: Record<Warning['level'], LucideIcon> = {
  avoid: ShieldAlert,
  caution: AlertTriangle,
  info: Info,
};

export interface ForYouCardProps {
  warnings: Warning[];
  hasProfile: boolean;
}

/** Returns the personalized warnings list, allergens first, with words, icons and source chips. */
export function ForYouCard({ warnings, hasProfile }: ForYouCardProps) {
  const { t } = useT();

  if (warnings.length === 0) {
    return (
      <section className="rounded-md border border-border p-4 text-sm">
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
      </section>
    );
  }

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
    <section className="space-y-3">
      <ul className="space-y-3">
        {sorted.map((warning) => {
          const Icon = LEVEL_ICON[warning.level];
          return (
            <li
              key={warning.id}
              className={cn(
                'space-y-2 rounded-md border border-border p-3 text-sm',
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
    </section>
  );
}
