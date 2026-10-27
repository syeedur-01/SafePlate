import { Info } from 'lucide-react';
import { useT } from '../i18n/i18n';

export interface NoticeBannerProps {
  noticeKeys: string[];
}

/** Returns always-visible bordered callouts for each notice key. */
export function NoticeBanner({ noticeKeys }: NoticeBannerProps) {
  const { t } = useT();

  return (
    <div className="space-y-2">
      {noticeKeys.map((key) => (
        <div
          key={key}
          role="note"
          className="flex gap-2 rounded-md border border-border bg-muted p-3 text-sm"
        >
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t(key)}</p>
        </div>
      ))}
    </div>
  );
}
