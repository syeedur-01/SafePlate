import type { ReadResourceResult, Resource } from '@modelcontextprotocol/sdk/types.js';
import { getAllergenKeywords, getDishes, getHealthRules, getSafetyRules } from '@sp/knowledge';

export const RESOURCES: Resource[] = [
  {
    uri: 'safeplate://dishes',
    name: 'Bangladeshi Food Knowledge Dishes',
    description:
      'Complete validated catalogue of 30 Bangladeshi dishes with ingredients, allergens, and cooking classes.',
    mimeType: 'application/json',
  },
  {
    uri: 'safeplate://safety-rules',
    name: 'Food Safety Rules & BSTI Standards',
    description:
      'Deterministic food safety rules, spoilage signs, and storage duration limits linked to BSTI and Codex evidence.',
    mimeType: 'application/json',
  },
  {
    uri: 'safeplate://health-rules',
    name: 'Clinical Health & Suitability Rules',
    description:
      'Clinical rules linking health conditions (hypertension, diabetes, gastric, cholesterol) and allergens to dietary thresholds.',
    mimeType: 'application/json',
  },
  {
    uri: 'safeplate://allergens',
    name: 'Allergen Lexicon & Keywords',
    description:
      'Bilingual allergen vocabulary mapping English and Bangla keywords to canonical food allergens.',
    mimeType: 'application/json',
  },
];

export function readResource(uri: string): ReadResourceResult {
  switch (uri) {
    case 'safeplate://dishes':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(getDishes(), null, 2),
          },
        ],
      };

    case 'safeplate://safety-rules':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(getSafetyRules(), null, 2),
          },
        ],
      };

    case 'safeplate://health-rules':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(getHealthRules(), null, 2),
          },
        ],
      };

    case 'safeplate://allergens':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(getAllergenKeywords(), null, 2),
          },
        ],
      };

    default:
      throw new Error(`Resource not found: ${uri}`);
  }
}
