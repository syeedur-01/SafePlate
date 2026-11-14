import type { AnalysisResult } from '@sp/contracts';
import { useT } from '../i18n/i18n';
import { Badge } from './ui/badge';

export interface SwapListProps {
  swaps: AnalysisResult['swaps'];
  dishNames: Record<string, string>;
}

/** Returns up to three alternative dishes with the nutrients each one improves. */
export function SwapList({ swaps, dishNames }: SwapListProps) {
  const { t } = useT();

  if (swaps.length === 0) {
    return <p className="text-sm">{t('swap.none')}</p>;
  }

  return (
    <ul className="space-y-3">
      {swaps.slice(0, 3).map((swap) => {
        const nutrientNames = swap.improves.map((nutrient) => t(`nutrient.${nutrient}`));
        return (
          <li key={swap.dishId} className="space-y-2 rounded-md border border-border p-3 text-sm">
            <p className="font-semibold">{dishNames[swap.dishId] ?? swap.dishId}</p>
            <ul className="flex flex-wrap gap-1">
              {swap.improves.map((nutrient, index) => (
                <li key={nutrient}>
                  <Badge variant="secondary">{nutrientNames[index]}</Badge>
                </li>
              ))}
            </ul>
            <p>{t(swap.reasonKey, { nutrient: nutrientNames.join(', ') })}</p>
          </li>
        );
      })}
    </ul>
  );
}
