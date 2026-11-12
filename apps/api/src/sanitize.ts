import type { LabelScanResult } from '@sp/contracts';

const MAX_INGREDIENTS_LENGTH = 2000;
const MIN_EXPIRY_YEAR = 2020;
const MAX_EXPIRY_YEAR = 2100;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Returns a label scan result with an implausible expiry date nulled and ingredient text capped at 2000 characters. */
export function sanitizeLabelResult(result: LabelScanResult): LabelScanResult {
  return {
    ...result,
    expiryDate: plausibleDateOrNull(result.expiryDate),
    ingredientsText:
      result.ingredientsText === null
        ? null
        : result.ingredientsText.slice(0, MAX_INGREDIENTS_LENGTH),
  };
}

/** Returns the date when it is a real calendar date within 2020-2100, otherwise null. */
function plausibleDateOrNull(value: string | null): string | null {
  if (value === null) return null;
  const match = DATE_PATTERN.exec(value);
  if (match === null) return null;
  const [, yearText = '', monthText = '', dayText = ''] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < MIN_EXPIRY_YEAR || year > MAX_EXPIRY_YEAR) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isReal ? value : null;
}
