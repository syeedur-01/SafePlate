import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SafetyResult } from '@sp/contracts';
import { useT } from '../i18n/i18n';

const GAUGE_PATH = 'M 20 100 A 80 80 0 0 1 180 100';

const LEVEL_STYLE = {
  low: { color: 'var(--risk-low)', Icon: ShieldCheck },
  moderate: { color: 'var(--risk-moderate)', Icon: AlertTriangle },
  high: { color: 'var(--risk-high)', Icon: ShieldAlert },
} as const;

export type RiskLevel = SafetyResult['level'];

export interface RiskGaugeProps {
  score: number;
  level: RiskLevel;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
  );
}

/** Returns the semicircle safety gauge with a score, level word and icon. */
export function RiskGauge({ score, level }: RiskGaugeProps) {
  const { t } = useT();
  const levelLabel = t(`safety.level.${level}`);
  const { color, Icon } = LEVEL_STYLE[level];
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const reducedMotion = prefersReducedMotion();

  return (
    <div
      role="img"
      aria-label={`${levelLabel}: ${score}/100`}
      className="mx-auto flex w-full max-w-xs flex-col items-center"
    >
      <div className="relative w-full">
        <svg viewBox="0 0 200 110" className="w-full" aria-hidden="true">
          <path
            d={GAUGE_PATH}
            fill="none"
            stroke="var(--border)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {reducedMotion ? (
            <path
              d={GAUGE_PATH}
              fill="none"
              stroke={color}
              strokeWidth="14"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={`${progress} 1`}
            />
          ) : (
            <motion.path
              d={GAUGE_PATH}
              fill="none"
              stroke={color}
              strokeWidth="14"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progress }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          )}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-4xl font-bold tabular-nums">{score}</span>
          <span className="text-xs text-fg">/100</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm font-semibold" style={{ color }}>
        <Icon aria-hidden="true" className="h-5 w-5" />
        <span>{levelLabel}</span>
      </div>
    </div>
  );
}
