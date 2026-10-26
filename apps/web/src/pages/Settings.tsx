import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useT } from '../i18n/i18n';
import type { ProfileStore } from '../state/profile-store';
import { useProfile } from '../state/useProfile';
import { ProfileForm } from './Onboarding';

export interface SettingsProps {
  store?: ProfileStore;
}

/** Returns settings with on-device profile editing and deletion. */
export function Settings({ store }: SettingsProps) {
  const { t } = useT();
  const navigate = useNavigate();
  const { profile, saveProfile, clearProfile } = useProfile(store);

  function handleDelete() {
    clearProfile();
    navigate('/welcome', { replace: true });
  }

  return (
    <div className="space-y-4">
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
          <p>{t('settings.deleteBody')}</p>
          <Button variant="destructive" onClick={handleDelete}>
            {t('settings.deleteData')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
