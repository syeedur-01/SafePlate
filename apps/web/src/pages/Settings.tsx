import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useT, type Lang } from '../i18n/i18n';
import { cn } from '../lib/cn';
import { DEFAULT_HISTORY_STORE, type HistoryStore } from '../state/history-store';
import type { ProfileStore } from '../state/profile-store';
import { useProfile } from '../state/useProfile';
import { ProfileForm } from './Onboarding';

export interface SettingsProps {
  store?: ProfileStore;
  historyStore?: HistoryStore;
}

/** Returns settings with language, on-device profile editing and full data deletion. */
export function Settings({ store, historyStore = DEFAULT_HISTORY_STORE }: SettingsProps) {
  const { t, lang, setLang } = useT();
  const { profile, saveProfile, clearProfile } = useProfile(store);
  const [deleted, setDeleted] = useState(false);

  function handleDelete() {
    clearProfile();
    historyStore.clear();
    setDeleted(true);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('onboarding.language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label={t('onboarding.language')} className="flex gap-2">
            {(['en', 'bn'] as const).map((value: Lang) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={lang === value}
                onClick={() => setLang(value)}
                className={cn(
                  'min-h-11 rounded-md border px-4 text-sm',
                  lang === value ? 'border-primary bg-muted font-medium' : 'border-border',
                )}
              >
                {t(`language.${value}`)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.editTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initialProfile={profile}
            now={() => new Date().toISOString()}
            onSave={saveProfile}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.deleteData')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deleted ? (
            <p role="status" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
              {t('settings.deleteBody')}
            </p>
          ) : (
            <>
              <p>{t('settings.deleteBody')}</p>
              <Button variant="destructive" onClick={handleDelete}>
                {t('settings.deleteData')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
