import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScanContext, ScanRequest } from '@sp/contracts';
import { mockScan, scan } from '../api/client';
import { Button, buttonVariants } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useT } from '../i18n/i18n';
import { cn } from '../lib/cn';
import { downscaleToJpeg } from '../lib/downscale';

const PLACES: readonly ScanContext['place'][] = [
  'home',
  'restaurant',
  'street',
  'packaged',
  'unknown',
];

const STORAGES: readonly ScanContext['storage'][] = [
  'fresh_just_made',
  'room_temp',
  'refrigerated',
  'unknown',
];

const USE_MOCK = import.meta.env.VITE_USE_MOCK === '1';

type Kind = ScanRequest['kind'];

/** Returns the scan screen for picking a photo, context and analysis. */
export function Scan() {
  const { t } = useT();
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind>('dish');
  const [file, setFile] = useState<File | null>(null);
  const [place, setPlace] = useState<ScanContext['place']>('unknown');
  const [storage, setStorage] = useState<ScanContext['storage']>('unknown');
  const [hours, setHours] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setError(null);
  }

  function handleKindChange(value: string) {
    setKind(value as Kind);
    setError(null);
  }

  function hoursSinceCooked(): number | null {
    if (kind !== 'dish' || hours.trim() === '') {
      return null;
    }
    const value = Number(hours);
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.min(240, Math.max(0, value));
  }

  async function analyze() {
    if (file === null || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [image, thumb] = await Promise.all([
        downscaleToJpeg(file, { max: 1024, quality: 0.8 }),
        downscaleToJpeg(file, { max: 160, quality: 0.8 }),
      ]);
      const request: ScanRequest = {
        kind,
        imageBase64: image.base64,
        mimeType: image.mimeType,
        context: { place, storage, hoursSinceCooked: hoursSinceCooked() },
      };
      const result = USE_MOCK ? mockScan(kind) : await scan(request);

      setLoading(false);
      navigate('/confirm', {
        state: { result, thumbDataUrl: `data:image/jpeg;base64,${thumb.base64}` },
      });
    } catch {
      setError(t('scan.error'));
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void analyze();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('page.scan.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={kind} onValueChange={handleKindChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dish">{t('scan.tab.dish')}</TabsTrigger>
            <TabsTrigger value="label">{t('scan.tab.label')}</TabsTrigger>
          </TabsList>
        </Tabs>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label
              className={cn(
                buttonVariants({ variant: 'secondary' }),
                'cursor-pointer focus-within:ring-2 focus-within:ring-primary',
              )}
            >
              {t('scan.choosePhoto')}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
            {file === null ? null : <p className="text-xs break-all">{file.name}</p>}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">{t('scan.place.label')}</legend>
            <div className="flex flex-wrap gap-2">
              {PLACES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={place === value}
                  onClick={() => setPlace(value)}
                  className={cn(
                    'min-h-11 rounded-full border px-3 text-sm',
                    place === value ? 'border-primary bg-muted font-medium' : 'border-border',
                  )}
                >
                  {t(`scan.place.${value}`)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">{t('scan.storage.label')}</legend>
            <div className="flex flex-wrap gap-2">
              {STORAGES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={storage === value}
                  onClick={() => setStorage(value)}
                  className={cn(
                    'min-h-11 rounded-full border px-3 text-sm',
                    storage === value ? 'border-primary bg-muted font-medium' : 'border-border',
                  )}
                >
                  {t(`scan.storage.${value}`)}
                </button>
              ))}
            </div>
          </fieldset>

          {kind === 'dish' ? (
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {t('scan.hours')}
              <input
                type="number"
                min={0}
                max={240}
                step={1}
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                className="min-h-11 w-32 rounded-md border border-border bg-card px-3 text-base font-normal text-fg"
              />
            </label>
          ) : null}

          {error === null ? null : (
            <div role="alert" className="space-y-3 rounded-md border border-risk-high p-3">
              <p className="text-sm text-risk-high">{error}</p>
              <Button variant="secondary" onClick={() => void analyze()} disabled={loading}>
                {t('scan.retry')}
              </Button>
            </div>
          )}

          <Button type="submit" disabled={file === null || loading}>
            {loading ? t('scan.analyzing') : t('scan.analyze')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
