import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useT } from '../i18n/i18n';

/** Returns the placeholder settings page. */
export function Settings() {
  const { t } = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('page.settings.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{t('page.settings.body')}</p>
      </CardContent>
    </Card>
  );
}
