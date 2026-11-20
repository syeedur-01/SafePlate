import { AllergenSchema, MessagesFileSchema, type Allergen, type Messages } from '@sp/contracts';
import messagesFile from '../data/messages.json';
import allergenKeywordsFile from '../data/allergen-keywords.json';
import allergenMatchingFile from '../data/allergen-matching.json';

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

/** Shape of the optional context rules in allergen-matching.json, mirroring the engine's AllergenMatching. */
export interface AllergenMatchingData {
  uncertain: Partial<Record<Allergen, string[]>>;
  suppress: Partial<Record<Allergen, string[]>>;
  advisoryPhrases: string[];
  negationBefore: string[];
  negationAfter: string[];
}

/** Returns the validated allergen matching context rules from data/allergen-matching.json. */
export function getAllergenMatching(): AllergenMatchingData {
  const raw = allergenMatchingFile as unknown as Record<string, unknown>;
  const stringList = (value: unknown, what: string): string[] => {
    if (!Array.isArray(value)) throw new Error(`allergen-matching.json: ${what} must be a list`);
    for (const item of value) {
      if (typeof item !== 'string' || item.length === 0)
        throw new Error(`allergen-matching.json: ${what} has an invalid entry`);
    }
    return value as string[];
  };
  const perAllergen = (value: unknown, what: string): Partial<Record<Allergen, string[]>> => {
    if (typeof value !== 'object' || value === null)
      throw new Error(`allergen-matching.json: ${what} must be an object`);
    const result: Partial<Record<Allergen, string[]>> = {};
    for (const [allergen, list] of Object.entries(value)) {
      if (!(ALLERGENS as readonly string[]).includes(allergen))
        throw new Error(`allergen-matching.json: ${what} has unknown allergen "${allergen}"`);
      result[allergen as Allergen] = stringList(list, `${what}.${allergen}`);
    }
    return result;
  };
  return {
    uncertain: perAllergen(raw.uncertain, 'uncertain'),
    suppress: perAllergen(raw.suppress, 'suppress'),
    advisoryPhrases: stringList(raw.advisoryPhrases, 'advisoryPhrases'),
    negationBefore: stringList(raw.negationBefore, 'negationBefore'),
    negationAfter: stringList(raw.negationAfter, 'negationAfter'),
  };
}
