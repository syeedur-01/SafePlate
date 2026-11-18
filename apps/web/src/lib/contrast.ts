/** Returns the WCAG 2.1 contrast ratio (1–21) between two 6-digit hex colours. */
export function contrastRatio(fg: string, bg: string): number {
  const first = relativeLuminance(fg);
  const second = relativeLuminance(bg);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Returns the sRGB channel value of one hex colour after the WCAG gamma correction. */
function channel(hex: string, index: number): number {
  const raw = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
}

/** Returns the WCAG relative luminance (0–1) of a 6-digit hex colour. */
function relativeLuminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}
