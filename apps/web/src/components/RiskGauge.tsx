import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SafetyResult } from '@sp/contracts';
import { useT } from '../i18n/i18n';

const GAUGE_PATH = 'M 20 100 A 80 80 0 0 1 180 100';
const ARC_WIDTH = 18;
const COUNT_DURATION_MS = 700;

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

/**
 * Returns the displayed score counting up from 0 to the target, or the final
 * value immediately when reduced motion is requested.
 */
function useCountUp(target: number, animate: boolean): number {
  const [value, setValue] = useState(() => (animate ? 0 : target));

  useEffect(() => {
    if (!animate) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      // Use performance.now() inside the tick: rAF timestamps can come from a
      // different clock origin (as in jsdom), which would break the arithmetic.
      const elapsed = Math.max(0, performance.now() - start);
      const progress = Math.min(1, elapsed / COUNT_DURATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, animate]);

  return value;
}

/** Returns the semicircle safety gauge with an animated score and a level status pill. */
export function RiskGauge({ score, level }: RiskGaugeProps) {
  const { t } = useT();
  const levelLabel = t(`safety.level.${level}`);
  const { color, Icon } = LEVEL_STYLE[level];
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const reducedMotion = prefersReducedMotion();
  const shownScore = useCountUp(score, !reducedMotion);

  return (
    <div
      role="img"
      // The label always carries the final score; the count-up is decoration only.
      aria-label={`${levelLabel}: ${score}/100`}
      className="mx-auto flex w-full max-w-xs flex-col items-center"
    >
      <div className="relative w-full">
        <svg viewBox="0 0 200 116" className="w-full" aria-hidden="true">
          <path
            d={GAUGE_PATH}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={ARC_WIDTH}
            strokeLinecap="round"
          />
          {reducedMotion ? (
            <path
              d={GAUGE_PATH}
              fill="none"
              stroke={color}
              strokeWidth={ARC_WIDTH}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={`${progress} 1`}
            />
          ) : (
            <motion.path
              d={GAUGE_PATH}
              fill="none"
              stroke={color}
              strokeWidth={ARC_WIDTH}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progress }}
              transition={{ duration: COUNT_DURATION_MS / 1000, ease: 'easeOut' }}
            />
          )}
        </svg>
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <span className="text-5xl font-bold tabular-nums text-heading">{shownScore}</span>
          <span className="text-xs text-muted-fg">/100</span>
        </div>
      </div>
      <div
        className="mt-3 flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
        style={{ color, backgroundColor: `${color}1f` }}
      >
        <Icon aria-hidden="true" className="h-5 w-5" />
        <span>{levelLabel}</span>
      </div>
    </div>
  );
}
