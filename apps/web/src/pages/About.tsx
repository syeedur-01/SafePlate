import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useT } from '../i18n/i18n';

/** Returns the placeholder about page. */
export function About() {
  const { t } = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('page.about.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{t('page.about.body')}</p>
      </CardContent>
    </Card>
  );
}
