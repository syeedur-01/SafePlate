import { SourcesFileSchema, type SourceEntry } from '@sp/contracts';
import sourcesFile from '@sp/knowledge/data/sources.json';
import appPackage from '../../package.json';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useT } from '../i18n/i18n';

const SOURCES = SourcesFileSchema.parse(sourcesFile).sources;
const APP_VERSION = appPackage.version;
const DATA_FROZEN_ON = '2026-11-14';

const TIER_KEYS: Record<SourceEntry['tier'], string> = {
  bangladesh: 'about.tier.bangladesh',
  global: 'about.tier.global',
  professional: 'about.tier.professional',
  data: 'about.tier.data',
};

const STATUS_KEYS: Record<SourceEntry['status'], string> = {
  verified: 'about.status.verified',
  unverified: 'about.status.unverified',
};

/** Returns the about page with the data sources, estimate and draft explanations and honest limits. */
export function About() {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('page.about.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>{t('page.about.body')}</p>
          <p className="text-sm">
            {t('about.version')}: {APP_VERSION} · {t('about.dataFrozen')}: {DATA_FROZEN_ON}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('about.estimated')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{t('about.estimatedBody')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('about.draft')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{t('about.draftBody')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('about.limits')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{t('notice.chemical_limit')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('about.sources')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {SOURCES.map((source) => (
              <li key={source.id} className="rounded-md border border-border p-3 text-sm">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline"
                >
                  {source.title}
                </a>
                <p className="text-sm">
                  {t('about.publisher')}: {source.publisher}
                </p>
                <p className="text-sm">
                  {t('about.tier')}: {t(TIER_KEYS[source.tier])} · {t('about.status')}:{' '}
                  {t(STATUS_KEYS[source.status])}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
