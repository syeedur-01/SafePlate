import { Badge } from './ui/badge';
import { useT } from '../i18n/i18n';

export type StatusBadgeKind = 'estimated' | 'draft';

export interface StatusBadgeProps {
  kind: StatusBadgeKind;
}

/** Returns the localized estimated or draft status badge. */
export function StatusBadge({ kind }: StatusBadgeProps) {
  const { t } = useT();

  return (
    <Badge variant={kind}>{t(kind === 'estimated' ? 'badge.estimated' : 'badge.draft')}</Badge>
  );
}
