import { AllergenSchema, SPOILAGE_SIGNS, type ScanContext } from '@sp/contracts';
import type { ProviderContext } from './provider';

const MAX_CANDIDATES = 3;
const MAX_NOTES_CHARS = 300;

/** Returns the dish-identification prompt listing every known dish and the exact JSON answer shape. */
export function buildDishPrompt(ctx: ProviderContext, context: ScanContext): string {
  const dishLines = ctx.dishes.map((dish) => {
    const aliases = dish.aliases.length > 0 ? ` (aliases: ${dish.aliases.join(', ')})` : '';
    return `- ${dish.id}: ${dish.name_en}${aliases}`;
  });
  return [
    `You are looking at one photograph of food in ${context.place}.`,
    `Identify which dish it might be. Answer with JSON only, no other text, exactly in this shape:`,
    `{"kind":"dish","candidates":[{"dishId":"<id>","label":"<display name>","confidence":<0..1>}],"observations":{"spoilageSigns":[],"imageQuality":"good|poor","notes":"<max ${MAX_NOTES_CHARS} chars>"}}`,
    `Rules:`,
    `- "dishId" must be one of these ids or null if none matches:`,
    ...dishLines,
    `- Give at most ${MAX_CANDIDATES} candidates, sorted by confidence, highest first.`,
    `- "spoilageSigns" may only use these exact values: ${SPOILAGE_SIGNS.join(', ')}.`,
    `- "notes" must be at most ${MAX_NOTES_CHARS} characters.`,
    `- Describe only what is visibly present in the photo. Do not guess or assume.`,
    `- Give no health or safety advice of any kind.`,
  ].join('\n');
}

/** Returns the packaged-label-extraction prompt demanding null for anything not readable. */
export function buildLabelPrompt(): string {
  return [
    `You are looking at one photograph of a packaged food label.`,
    `Transcribe what is readable. Answer with JSON only, no other text, exactly in this shape:`,
    `{"kind":"label","productName":"<string or null>","ingredientsText":"<string or null>","declaredAllergens":[],"expiryDate":"<YYYY-MM-DD or null>","nutritionPer100g":{...},"observations":{"spoilageSigns":[],"imageQuality":"good|poor","notes":"<max ${MAX_NOTES_CHARS} chars>"}}`,
    `Rules:`,
    `- "declaredAllergens" may only use these exact values: ${AllergenSchema.options.join(', ')}.`,
    `- "expiryDate" must be formatted YYYY-MM-DD, or null if not readable.`,
    `- Use null for any field that is not clearly readable. Never guess a value.`,
    `- Describe only what is visibly printed on the label. Do not guess or assume.`,
    `- Give no health or safety advice of any kind.`,
  ].join('\n');
}
