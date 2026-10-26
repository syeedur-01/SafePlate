import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useT } from '../i18n/i18n';

/** Returns the placeholder history page. */
export function History() {
  const { t } = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('page.history.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{t('page.history.body')}</p>
      </CardContent>
    </Card>
  );
}
