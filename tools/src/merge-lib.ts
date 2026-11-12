/** Merges proposal rules into a final list. Throws if a rule's sourceRef is missing or not in the register, or if ids are duplicated. Keeps each rule's status exactly as written. */
export function mergeRules<T extends { id: string; sourceRef: string | null }>(
  proposals: T[],
  sourceIds: Set<string>,
): T[] {
  const seen = new Set<string>();
  for (const rule of proposals) {
    if (rule.sourceRef === null || !sourceIds.has(rule.sourceRef)) {
      throw new Error(
        `rule ${rule.id}: sourceRef ${JSON.stringify(rule.sourceRef)} is missing from the source register`,
      );
    }
    if (seen.has(rule.id)) {
      throw new Error(`rule ${rule.id}: duplicate id in proposals`);
    }
    seen.add(rule.id);
  }
  return [...proposals];
}

/** Returns the ids of dishes whose energy coverage is at least minCoverage, sorted. */
export function demoDishIds(
  coverageByDish: Array<{ dishId: string; energyCoverage: number }>,
  minCoverage: number = 0.8,
): string[] {
  return coverageByDish
    .filter((dish) => dish.energyCoverage >= minCoverage)
    .map((dish) => dish.dishId)
    .sort();
}
