import type { ScanRequest } from '@sp/contracts';
import type { ProviderContext, VisionProvider } from './provider';
import dishKacchiBiryani from '../../../fixtures/mock-scan/dish-kacchi-biryani.json';
import dishMishtiDoiSpoiled from '../../../fixtures/mock-scan/dish-mishti-doi-spoiled.json';
import dishShutkiBhorta from '../../../fixtures/mock-scan/dish-shutki-bhorta.json';
import dishUnknown from '../../../fixtures/mock-scan/dish-unknown.json';
import labelPoorQuality from '../../../fixtures/mock-scan/label-poor-quality.json';
import labelSnack from '../../../fixtures/mock-scan/label-snack.json';

type FixtureStem =
  | 'dish-kacchi-biryani'
  | 'dish-mishti-doi-spoiled'
  | 'dish-shutki-bhorta'
  | 'dish-unknown'
  | 'label-poor-quality'
  | 'label-snack';

const DISH_FIXTURES = [
  dishKacchiBiryani,
  dishMishtiDoiSpoiled,
  dishShutkiBhorta,
  dishUnknown,
] as const;
const LABEL_FIXTURES = [labelPoorQuality, labelSnack] as const;
const HASH_PREFIX_LENGTH = 50;

/** Counts the character codes of the first HASH_PREFIX_LENGTH characters of the image data. */
function hashImage(imageBase64: string): number {
  let sum = 0;
  for (const char of imageBase64.slice(0, HASH_PREFIX_LENGTH)) sum += char.charCodeAt(0);
  return sum;
}

/** Deterministic provider: picks a fixture from fixtures/mock-scan by kind and a hash of the image. */
export class MockProvider implements VisionProvider {
  readonly name = 'mock';

  constructor(private readonly opts?: { forceFixture?: FixtureStem }) {}

  analyze(req: ScanRequest, ctx: ProviderContext): Promise<unknown> {
    void ctx; // the mock ignores the dish context
    const picked =
      this.opts?.forceFixture !== undefined ? pickByStem(this.opts.forceFixture) : pickByHash(req);
    return Promise.resolve(structuredClone(picked));
  }
}

function pickByHash(req: ScanRequest): unknown {
  const fixtures = req.kind === 'dish' ? DISH_FIXTURES : LABEL_FIXTURES;
  const index = hashImage(req.imageBase64) % fixtures.length;
  const picked = fixtures[index];
  if (picked === undefined) throw new Error('fixture list must not be empty');
  return picked;
}

function pickByStem(stem: string): unknown {
  const byStem = new Map<string, unknown>([
    ['dish-kacchi-biryani', dishKacchiBiryani],
    ['dish-mishti-doi-spoiled', dishMishtiDoiSpoiled],
    ['dish-shutki-bhorta', dishShutkiBhorta],
    ['dish-unknown', dishUnknown],
    ['label-poor-quality', labelPoorQuality],
    ['label-snack', labelSnack],
  ]);
  const picked = byStem.get(stem);
  if (picked === undefined) {
    throw new Error(
      `unknown mock fixture stem: ${stem}; known stems: ${[...byStem.keys()].join(', ')}`,
    );
  }
  return picked;
}
