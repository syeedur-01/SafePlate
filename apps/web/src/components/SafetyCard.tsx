import type { SafetyResult } from '@sp/contracts';
import { useT } from '../i18n/i18n';
import { EvidenceList } from './EvidenceList';
import { NoticeBanner } from './NoticeBanner';
import { RiskGauge } from './RiskGauge';

export interface SafetyCardProps {
  safety: SafetyResult;
}

/** Returns the safety card with the risk gauge, evidence, next steps and always-visible notices. */
export function SafetyCard({ safety }: SafetyCardProps) {
  const { t } = useT();

  return (
    <section className="space-y-4">
      <RiskGauge score={safety.score} level={safety.level} />
      <EvidenceList signals={safety.signals} rulesStatus={safety.rulesStatus} />
      {safety.mitigationKeys.length === 0 ? null : (
        <section aria-labelledby="safety-next-steps" className="space-y-2">
          <h3 id="safety-next-steps" className="text-sm font-semibold">
            {t('safety.next_steps')}
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {safety.mitigationKeys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>
      )}
      <NoticeBanner noticeKeys={safety.notices} />
    </section>
  );
}
