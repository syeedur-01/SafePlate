// label-corpus.test.ts: allergen matching corpus over the real keyword and matching data.
// Positive, negative and ambiguous phrases in English, Bangla script and romanized Bangla.
// These are unit examples, not a measured accuracy benchmark; no accuracy figure is claimed.
import { describe, it, expect } from 'vitest';
import { getAllergenKeywords, getAllergenMatching } from '@sp/knowledge';
import { detectAllergens, type AllergenKeywords, type AllergenMatching } from '../src/label';

const keywords: AllergenKeywords = getAllergenKeywords();
const matching: AllergenMatching = getAllergenMatching();

/** Returns the sorted allergen ids detected with `via: 'ingredients'` and no uncertainty. */
function confirmed(text: string): string[] {
  return detectAllergens({ ingredientsText: text, declaredAllergens: [] }, keywords, matching)
    .filter((d) => d.via === 'ingredients' && !d.uncertain)
    .map((d) => d.allergen)
    .sort();
}

/** Returns the sorted allergen ids detected only as uncertain ingredient matches. */
function uncertain(text: string): string[] {
  return detectAllergens({ ingredientsText: text, declaredAllergens: [] }, keywords, matching)
    .filter((d) => d.via === 'ingredients' && d.uncertain)
    .map((d) => d.allergen)
    .sort();
}

/** Returns the sorted allergen ids detected only inside a may-contain/advisory statement. */
function advisory(text: string): string[] {
  return detectAllergens({ ingredientsText: text, declaredAllergens: [] }, keywords, matching)
    .filter((d) => d.via === 'advisory')
    .map((d) => d.allergen)
    .sort();
}

describe('allergen label corpus (English)', () => {
  it('confirms allergens from a plain ingredient list', () => {
    expect(confirmed('Wheat flour, milk powder, peanut oil')).toEqual([
      'milk',
      'peanuts',
      'wheat_gluten',
    ]);
    expect(confirmed('water, sugar, whole milk, cardamom')).toEqual(['milk']);
  });
  it('does not confirm wheat for non-wheat flours', () => {
    expect(confirmed('rice flour, water, salt')).toEqual([]);
    expect(confirmed('chickpea flour (besan), onion, spices')).toEqual([]);
    expect(confirmed('corn flour, sugar')).toEqual([]);
  });
  it('marks generic "flour" as an uncertain wheat match, not a confirmed one', () => {
    expect(confirmed('flour, sugar, water')).toEqual([]);
    expect(uncertain('flour, sugar, water')).toEqual(['wheat_gluten']);
  });
  it('still confirms wheat when a qualified wheat phrase is present', () => {
    expect(confirmed('rice flour and refined flour')).toEqual(['wheat_gluten']);
    expect(confirmed('whole wheat, sugar')).toEqual(['wheat_gluten']);
  });
  it('does not flag words that merely contain an allergen word', () => {
    expect(confirmed('eggplant, lentil, shellfish-free seasoning')).toEqual([]);
  });
  it('marks a bare ambiguous nut word as uncertain and a named nut as confirmed', () => {
    expect(uncertain('badam, sugar')).toEqual(['tree_nuts']);
    expect(confirmed('cashew nut, sugar')).toEqual(['tree_nuts']);
    // chinabadam is peanut, not tree nut: the bare word must not leak
    expect(confirmed('chinabadam (groundnut), sugar')).toEqual(['peanuts']);
    expect(uncertain('chinabadam (groundnut), sugar')).toEqual([]);
  });
  it('suppresses negated allergens', () => {
    expect(confirmed('sugar, does not contain milk, vegetable oil')).toEqual([]);
    expect(confirmed('free from gluten and milk')).toEqual([]);
    expect(confirmed('made without egg, wheat-free')).toEqual([]);
  });
  it('treats may-contain statements as advisory, not confirmed', () => {
    expect(confirmed('may contain milk and soy')).toEqual([]);
    expect(advisory('may contain milk and soy')).toEqual(['milk', 'soy']);
    expect(advisory('sugar, wheat flour, may contain traces of peanuts')).toEqual(['peanuts']);
    expect(confirmed('sugar, wheat flour, may contain traces of peanuts')).toEqual([
      'wheat_gluten',
    ]);
  });
  it('keeps confirmed detection when real ingredients appear alongside an advisory', () => {
    expect(confirmed('contains milk powder. may contain soy.')).toEqual(['milk']);
  });
});

describe('allergen label corpus (Bangla script)', () => {
  it('confirms Bangla-script allergens', () => {
    expect(confirmed('গম, দুধ, চিংড়ি')).toEqual(['crustacean_shellfish', 'milk', 'wheat_gluten']);
  });
  it('does not confuse peanut and nut words in Bangla script', () => {
    expect(confirmed('চিনাবাদাম, লবণ')).toEqual(['peanuts']);
    expect(uncertain('বাদাম, চিনি')).toEqual(['tree_nuts']);
    expect(confirmed('কাঠবাদাম, চিনি')).toEqual(['tree_nuts']);
  });
  it('suppresses Bangla negation ("ছাড়া")', () => {
    expect(confirmed('দুধ ছাড়া কেক')).toEqual([]);
    expect(confirmed('চিনি, আটা, দুধ ছাড়া')).toEqual(['wheat_gluten']);
  });
  it('treats Bangla may-contain statements as advisory', () => {
    expect(advisory('এই পণ্যে দুধ থাকতে পারে')).toEqual(['milk']);
    expect(confirmed('এই পণ্যে দুধ থাকতে পারে')).toEqual([]);
  });
  it('does not flag an inflected form that hides a keyword inside a longer word', () => {
    // তিল (sesame) inside তিলা... style words must not match
    expect(confirmed('তেলাবাজার, চিনি')).toEqual([]);
  });
});

describe('allergen label corpus (romanized Bangla and OCR noise)', () => {
  it('confirms romanized allergen words', () => {
    expect(confirmed('shorshe tel, moshor, chingri')).toEqual(['crustacean_shellfish', 'mustard']);
    expect(confirmed('chingrir shorshe bata')).toEqual(['crustacean_shellfish', 'mustard']);
  });
  it('handles OCR-style case and punctuation noise', () => {
    expect(confirmed('WHEAT.  FLOUR - refined flour; MILK POWDER')).toEqual([
      'milk',
      'wheat_gluten',
    ]);
  });
  it('marks romanized ambiguous nut word as uncertain', () => {
    expect(uncertain('badam bata')).toEqual(['tree_nuts']);
    expect(confirmed('badam bata')).toEqual([]);
  });
});
