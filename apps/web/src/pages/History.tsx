import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useT } from '../i18n/i18n';
import {
  DEFAULT_HISTORY_STORE,
  type HistoryEntry,
  type HistoryStore,
} from '../state/history-store';

export interface HistoryProps {
  store?: HistoryStore;
}

function formatDate(at: string, lang: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) {
    return at;
  }
  return date.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Returns the on-device scan history, newest first. */
export function History({ store = DEFAULT_HISTORY_STORE }: HistoryProps) {
  const { t, lang } = useT();
  const [entries] = useState<HistoryEntry[]>(() => store.list());

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('page.history.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p>{t('page.history.body')}</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                {entry.thumb === null ? null : (
                  <img src={entry.thumb} alt="" className="h-12 w-12 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{entry.title}</p>
                  <p className="text-sm text-fg/70">{formatDate(entry.at, lang)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{entry.score}/100</p>
                  <p className="text-sm text-fg/70">{t(`safety.level.${entry.level}`)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
