import type { SafetyResult } from '@sp/contracts';
import { Badge } from './ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { useT } from '../i18n/i18n';
import { StatusBadge } from './StatusBadge';

export type EvidenceSignal = SafetyResult['signals'][number];

export interface EvidenceListProps {
  signals: EvidenceSignal[];
  rulesStatus: SafetyResult['rulesStatus'];
}

/** Returns the collapsible evidence list with points and source references. */
export function EvidenceList({ signals, rulesStatus }: EvidenceListProps) {
  const { t } = useT();

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={signals.length === 0 ? 'evidence' : undefined}
    >
      <AccordionItem value="evidence">
        <AccordionTrigger>
          <span className="flex flex-wrap items-center gap-2">
            <span>{t('evidence.title')}</span>
            {rulesStatus === 'draft' ? <StatusBadge kind="draft" /> : null}
          </span>
        </AccordionTrigger>
        <AccordionContent>
          {signals.length === 0 ? (
            <p>{t('safety.no_signals')}</p>
          ) : (
            <ul className="space-y-3">
              {signals.map((signal) => (
                <li key={signal.ruleId} className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{t(signal.labelKey)}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-risk-high">
                      +{signal.points}
                    </span>
                  </div>
                  <p>{signal.evidence}</p>
                  {signal.sourceRef === null ? null : (
                    <Badge
                      variant="outline"
                      title={signal.sourceRef}
                      aria-label={`${t('evidence.source')}: ${signal.sourceRef}`}
                    >
                      {t('evidence.source')}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
