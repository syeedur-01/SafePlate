import type { ScanContext, UserProfile } from '@sp/contracts';

export interface Scenario {
  id: string;
  titleKey: string;
  fixture: string; // file stem in fixtures/mock-scan
  dishId: string | null;
  profile: Pick<UserProfile, 'conditions' | 'allergies'>;
  context: ScanContext;
  servings: number;
}

const UNKNOWN_CONTEXT: ScanContext = {
  place: 'unknown',
  storage: 'unknown',
  hoursSinceCooked: null,
};

/** Returns the four offline demo scenarios that run the real engine on canned scans. */
export const SCENARIOS: Scenario[] = [
  {
    id: 'festive-rice-blood-pressure',
    titleKey: 'demo.scenario.festive-rice-blood-pressure',
    fixture: 'dish-kacchi-biryani',
    dishId: 'kacchi-biryani',
    profile: { conditions: ['hypertension'], allergies: [] },
    context: UNKNOWN_CONTEXT,
    servings: 1,
  },
  {
    id: 'dairy-sweet-left-out',
    titleKey: 'demo.scenario.dairy-sweet-left-out',
    fixture: 'dish-mishti-doi-spoiled',
    dishId: 'mishti-doi',
    profile: { conditions: [], allergies: [] },
    context: { place: 'home', storage: 'room_temp', hoursSinceCooked: 6 },
    servings: 1,
  },
  {
    id: 'label-with-milk-allergy',
    titleKey: 'demo.scenario.label-with-milk-allergy',
    fixture: 'label-snack',
    dishId: null,
    profile: { conditions: [], allergies: ['milk'] },
    context: UNKNOWN_CONTEXT,
    servings: 1,
  },
  {
    id: 'fish-allergy-bhorta',
    titleKey: 'demo.scenario.fish-allergy-bhorta',
    fixture: 'dish-shutki-bhorta',
    dishId: 'shutki-bhorta',
    profile: { conditions: [], allergies: ['fish'] },
    context: UNKNOWN_CONTEXT,
    servings: 1,
  },
];
