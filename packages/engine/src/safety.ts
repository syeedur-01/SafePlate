import type { SafetyResult, SafetyRule, SafetyTag, ScanContext, SpoilageSign } from '@sp/contracts';

type SafetyTrigger = SafetyRule['trigger'];

export const SAFETY_LEVEL_BOUNDS = { moderate: 25, high: 60 } as const;
export const CHEMICAL_LIMIT_NOTICE_KEY = 'notice.chemical_limit';
export const POOR_IMAGE_NOTICE_KEY = 'notice.poor_image';

export interface SafetyInput {
  dishTags: SafetyTag[];
  observations: { spoilageSigns: SpoilageSign[]; imageQuality: 'good' | 'poor' };
  context: ScanContext;
  label: { expiryDate: string | null } | null;
  today: string; // 'YYYY-MM-DD', injected, never read from the clock
}

type SafetySignal = SafetyResult['signals'][number];

/** Returns true when a rule's trigger matches the input, with the evidence text it earns. */
function checkTrigger(
  trigger: SafetyTrigger,
  input: SafetyInput,
): { evidence: string } | { evidence: null } {
  switch (trigger.type) {
    case 'spoilage_sign':
      return input.observations.spoilageSigns.includes(trigger.sign)
        ? { evidence: `Photo shows: ${trigger.sign}` }
        : { evidence: null };
    case 'storage_hours': {
      const { hoursSinceCooked } = input.context;
      if (input.context.storage !== trigger.storage) return { evidence: null };
      if (hoursSinceCooked === null || hoursSinceCooked < trigger.minHours)
        return { evidence: null };
      if (trigger.tags !== undefined && !trigger.tags.some((tag) => input.dishTags.includes(tag)))
        return { evidence: null };
      return { evidence: `Kept ${trigger.storage} for ${hoursSinceCooked} h` };
    }
    case 'dish_tag': {
      if (!input.dishTags.includes(trigger.tag)) return { evidence: null };
      if (trigger.place !== undefined && trigger.place !== input.context.place)
        return { evidence: null };
      return { evidence: `Dish category: ${trigger.tag}` };
    }
    case 'label_expired': {
      const { expiryDate } = input.label ?? {};
      if (expiryDate === undefined || expiryDate === null || expiryDate >= input.today)
        return { evidence: null };
      return { evidence: `Expiry date ${expiryDate} has passed` };
    }
  }
}

/** Scores a scan from rules, with every point tied to evidence, per TECH_DESIGN §4.2. */
export function scoreSafety(input: SafetyInput, rules: SafetyRule[]): SafetyResult {
  const signals: SafetySignal[] = [];
  const mitigationSeen = new Set<string>();
  for (const rule of rules) {
    const { evidence } = checkTrigger(rule.trigger, input);
    if (evidence === null) continue;
    signals.push({
      ruleId: rule.id,
      labelKey: rule.labelKey,
      points: rule.points,
      evidence,
      sourceRef: rule.sourceRef,
    });
    for (const key of rule.mitigationKeys) {
      if (!mitigationSeen.has(key)) {
        mitigationSeen.add(key);
      }
    }
  }
  const rawScore = signals.reduce((sum, s) => sum + s.points, 0);
  const score = Math.min(100, rawScore);
  const level =
    score < SAFETY_LEVEL_BOUNDS.moderate
      ? 'low'
      : score < SAFETY_LEVEL_BOUNDS.high
        ? 'moderate'
        : 'high';
  const notices = [CHEMICAL_LIMIT_NOTICE_KEY];
  if (input.observations.imageQuality === 'poor') notices.push(POOR_IMAGE_NOTICE_KEY);
  const anyDraft = rules.some((rule) => rule.status === 'draft');
  return {
    score,
    level,
    signals,
    mitigationKeys: [...mitigationSeen],
    notices,
    rulesStatus: anyDraft ? 'draft' : 'approved',
  };
}
