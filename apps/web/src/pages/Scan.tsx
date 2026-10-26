import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useT } from '../i18n/i18n';

/** Returns the placeholder scan page for the web scaffold. */
export function Scan() {
  const { t } = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('page.scan.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{t('page.scan.body')}</p>
      </CardContent>
    </Card>
  );
}
