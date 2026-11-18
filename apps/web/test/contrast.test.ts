import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio } from '../src/lib/contrast';

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colours', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });
  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBeCloseTo(contrastRatio('#fedcba', '#123456'), 5);
  });
});

const CSS_PATH = ['src/index.css', 'apps/web/src/index.css']
  .map((relative) => resolve(process.cwd(), relative))
  .find((candidate) => existsSync(candidate));
if (CSS_PATH === undefined) {
  throw new Error(`index.css not found relative to ${process.cwd()}`);
}
const CSS = readFileSync(CSS_PATH, 'utf8');

/** Returns the custom properties declared in the first block after the given selector. */
function tokensAfter(selector: string, from = 0): Record<string, string> {
  const at = CSS.indexOf(selector, from);
  expect(at, `selector not found in index.css: ${selector}`).toBeGreaterThan(-1);
  const open = CSS.indexOf('{', at);
  const close = CSS.indexOf('}', open);
  const tokens: Record<string, string> = {};
  for (const match of CSS.slice(open + 1, close).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    const key = match[1];
    const value = match[2];
    if (key !== undefined && value !== undefined) {
      tokens[key] = value.toLowerCase();
    }
  }
  return tokens;
}

/** Returns the palette's value for one token, failing loudly when the token is missing. */
function token(palette: Record<string, string>, key: string): string {
  const value = palette[key];
  if (value === undefined) {
    throw new Error(`palette does not declare --${key}`);
  }
  return value;
}

const LIGHT = tokensAfter(':root {');
const MEDIA_DARK = tokensAfter(':root {', CSS.indexOf('@media (prefers-color-scheme: dark)'));
const FORCED_DARK = tokensAfter(":root[data-theme='dark']");

const THEMES: Array<{ name: string; tokens: Record<string, string> }> = [
  { name: 'light', tokens: LIGHT },
  { name: 'dark (prefers-color-scheme)', tokens: MEDIA_DARK },
  { name: 'dark (forced data-theme)', tokens: FORCED_DARK },
];

describe('design tokens in index.css', () => {
  it('declares every colour token the app uses', () => {
    for (const { name, tokens } of THEMES) {
      for (const key of [
        'bg',
        'fg',
        'card',
        'muted',
        'primary',
        'primary-fg',
        'border',
        'risk-low',
        'risk-moderate',
        'risk-high',
      ]) {
        expect(token(tokens, key), `${name}: --${key}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('keeps the two dark palettes identical', () => {
    expect(MEDIA_DARK).toEqual(FORCED_DARK);
  });

  for (const { name, tokens } of THEMES) {
    describe(`${name} theme`, () => {
      it('keeps body text at or above 4.5:1 on every text background', () => {
        expect(contrastRatio(token(tokens, 'fg'), token(tokens, 'bg'))).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(token(tokens, 'fg'), token(tokens, 'card'))).toBeGreaterThanOrEqual(
          4.5,
        );
        expect(contrastRatio(token(tokens, 'fg'), token(tokens, 'muted'))).toBeGreaterThanOrEqual(
          4.5,
        );
      });

      it('keeps the primary button label at or above 4.5:1', () => {
        expect(
          contrastRatio(token(tokens, 'primary-fg'), token(tokens, 'primary')),
        ).toBeGreaterThanOrEqual(4.5);
      });

      it('keeps link text at or above 4.5:1 on page and card backgrounds', () => {
        expect(contrastRatio(token(tokens, 'primary'), token(tokens, 'bg'))).toBeGreaterThanOrEqual(
          4.5,
        );
        expect(
          contrastRatio(token(tokens, 'primary'), token(tokens, 'card')),
        ).toBeGreaterThanOrEqual(4.5);
      });

      it('keeps each risk colour at or above 3.0:1 on the card background', () => {
        for (const key of ['risk-low', 'risk-moderate', 'risk-high']) {
          expect(
            contrastRatio(token(tokens, key), token(tokens, 'card')),
            `${name}: --${key} on --card`,
          ).toBeGreaterThanOrEqual(3);
        }
      });
    });
  }
});
