import type { Allergen, Warning } from '@sp/contracts';

/** Returns the user's allergens that appear in the dish, in the user's order, without duplicates. */
export function allergenConflicts(
  userAllergies: Allergen[],
  dishAllergens: Allergen[],
): Allergen[] {
  const inDish = new Set(dishAllergens);
  const seen = new Set<Allergen>();
  const conflicts: Allergen[] = [];
  for (const a of userAllergies) {
    if (!inDish.has(a) || seen.has(a)) continue;
    seen.add(a);
    conflicts.push(a);
  }
  return conflicts;
}

/** Returns one `avoid` warning per conflicting allergen. */
export function allergenWarnings(userAllergies: Allergen[], dishAllergens: Allergen[]): Warning[] {
  return allergenConflicts(userAllergies, dishAllergens).map((allergen) => ({
    id: `allergen:${allergen}`,
    kind: 'allergen',
    level: 'avoid',
    condition: null,
    allergen,
    messageKey: 'warn.allergen_present',
    params: { allergen },
    sourceRef: null,
  }));
}
