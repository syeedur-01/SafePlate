import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanResultSchema, type ScanResult } from '@sp/contracts';
import { ImageOff } from 'lucide-react';
import kacchiJson from '../../../../fixtures/mock-scan/dish-kacchi-biryani.json';
import mishtiDoiJson from '../../../../fixtures/mock-scan/dish-mishti-doi-spoiled.json';
import unknownDishJson from '../../../../fixtures/mock-scan/dish-unknown.json';
import labelSnackJson from '../../../../fixtures/mock-scan/label-snack.json';
import { useT } from '../i18n/i18n';
import { Badge } from './ui/badge';

interface Sample {
  labelKey: string;
  result: ScanResult;
  /** URL of the licensed sample photo in public/samples (see CREDITS.md there). */
  imageSrc: string;
}

const SAMPLES: readonly Sample[] = [
  {
    labelKey: 'scan.sample.kacchi',
    result: ScanResultSchema.parse(kacchiJson),
    imageSrc: '/samples/sample-kacchi-biryani.jpg',
  },
  {
    labelKey: 'scan.sample.mishtiDoi',
    result: ScanResultSchema.parse(mishtiDoiJson),
    imageSrc: '/samples/sample-mishti-doi.jpg',
  },
  {
    labelKey: 'scan.sample.labelSnack',
    result: ScanResultSchema.parse(labelSnackJson),
    imageSrc: '/samples/sample-label-snack.jpg',
  },
  {
    labelKey: 'scan.sample.unknown',
    result: ScanResultSchema.parse(unknownDishJson),
    imageSrc: '/samples/sample-unknown-dish.jpg',
  },
];

interface SampleCardProps {
  sample: Sample;
  onRun: () => void;
}

/** Returns one sample photo card; a broken photo degrades to a labelled placeholder. */
function SampleCard({ sample, onRun }: SampleCardProps) {
  const { t } = useT();
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onRun}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-2 text-left shadow-card transition-all hover:border-primary hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface-soft">
        {failed ? (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-fg">
            <ImageOff aria-hidden="true" className="h-5 w-5" />
            <span className="text-xs">{t(sample.labelKey)}</span>
          </span>
        ) : (
          <img
            src={sample.imageSrc}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        )}
      </span>
      <span className="flex flex-col items-start gap-1 px-1 pb-1 pt-2">
        <span className="text-sm font-semibold leading-snug text-heading">
          {t(sample.labelKey)}
        </span>
        <Badge variant="outline">{t('scan.sample.noAiCall')}</Badge>
      </span>
    </button>
  );
}

/** Returns the offline sample cards that run fixtures without any AI call. */
export function SamplePicker() {
  const { t } = useT();
  const navigate = useNavigate();

  function runSample(result: ScanResult) {
    if (result.kind === 'label') {
      navigate('/result', {
        state: { scanResult: result, dishId: null, thumbDataUrl: null },
      });
      return;
    }
    navigate('/confirm', { state: { result, thumbDataUrl: null } });
  }

  return (
    <section aria-labelledby="sample-picker-title" className="space-y-3">
      <h2 id="sample-picker-title" className="text-sm font-semibold">
        {t('scan.sample.title')}
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SAMPLES.map((sample) => (
          <SampleCard
            key={sample.labelKey}
            sample={sample}
            onRun={() => runSample(sample.result)}
          />
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-fg">{t('scan.sample.credits')}</p>
    </section>
  );
}
