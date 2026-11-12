import { AllergenSchema, MessagesFileSchema, type Allergen, type Messages } from '@sp/contracts';
import messagesFile from '../data/messages.json';
import allergenKeywordsFile from '../data/allergen-keywords.json';

/** Returns the validated bilingual message catalogue from data/messages.json (messageKey to en/bn text). */
export function getMessages(): Messages {
  return MessagesFileSchema.parse(messagesFile);
}

const ALLERGENS = AllergenSchema.options as readonly Allergen[];

/** Returns the allergen keyword lists from data/allergen-keywords.json, covering all ten allergens. */
export function getAllergenKeywords(): Record<Allergen, string[]> {
  const raw = allergenKeywordsFile as unknown as Record<string, unknown>;
  const keywords = {} as Record<Allergen, string[]>;
  for (const allergen of ALLERGENS) {
    const words = raw[allergen];
    if (!Array.isArray(words) || words.length === 0) {
      throw new Error(`allergen-keywords.json is missing keywords for "${allergen}"`);
    }
    for (const word of words) {
      if (typeof word !== 'string' || word.length === 0) {
        throw new Error(`allergen-keywords.json has an invalid keyword for "${allergen}"`);
      }
    }
    keywords[allergen] = words.map((word) => String(word));
  }
  return keywords;
}
