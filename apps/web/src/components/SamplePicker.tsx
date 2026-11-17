import { useNavigate } from 'react-router-dom';
import { ScanResultSchema, type ScanResult } from '@sp/contracts';
import kacchiJson from '../../../../fixtures/mock-scan/dish-kacchi-biryani.json';
import mishtiDoiJson from '../../../../fixtures/mock-scan/dish-mishti-doi-spoiled.json';
import unknownDishJson from '../../../../fixtures/mock-scan/dish-unknown.json';
import labelSnackJson from '../../../../fixtures/mock-scan/label-snack.json';
import { useT } from '../i18n/i18n';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface Sample {
  labelKey: string;
  result: ScanResult;
}

const SAMPLES: readonly Sample[] = [
  { labelKey: 'scan.sample.kacchi', result: ScanResultSchema.parse(kacchiJson) },
  { labelKey: 'scan.sample.mishtiDoi', result: ScanResultSchema.parse(mishtiDoiJson) },
  { labelKey: 'scan.sample.labelSnack', result: ScanResultSchema.parse(labelSnackJson) },
  { labelKey: 'scan.sample.unknown', result: ScanResultSchema.parse(unknownDishJson) },
];

/** Returns the offline sample buttons that run fixtures without any AI call. */
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
      <div className="flex flex-wrap gap-2">
        {SAMPLES.map((sample) => (
          <Button
            key={sample.labelKey}
            variant="secondary"
            className="h-auto flex-col items-start gap-1 py-2 text-left"
            onClick={() => runSample(sample.result)}
          >
            <span>{t(sample.labelKey)}</span>
            <Badge variant="outline">{t('scan.sample.noAiCall')}</Badge>
          </Button>
        ))}
      </div>
    </section>
  );
}
