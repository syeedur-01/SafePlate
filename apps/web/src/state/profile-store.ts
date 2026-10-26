import { EMPTY_PROFILE, UserProfileSchema, type UserProfile } from '@sp/contracts';

export const PROFILE_KEY = 'sp.profile.v1';

export interface ProfileStore {
  load(): UserProfile;
  save(p: UserProfile): void;
  clear(): void;
}

export type ProfileStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getDefaultStorage(): ProfileStorage | undefined {
  try {
    return typeof globalThis.localStorage === 'undefined' ? undefined : globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** Returns a profile store backed by localStorage or the supplied storage. */
export class LocalProfileStore implements ProfileStore {
  private readonly storage: ProfileStorage | undefined;

  constructor(storage?: ProfileStorage) {
    this.storage = storage ?? getDefaultStorage();
  }

  /** Returns the saved profile, or EMPTY_PROFILE when missing or invalid. */
  load(): UserProfile {
    return this.read() ?? EMPTY_PROFILE;
  }

  /** Returns true when the stored profile exists and passes the schema. */
  hasSaved(): boolean {
    return this.read() !== null;
  }

  /** Returns nothing; writes the profile to the device. */
  save(p: UserProfile): void {
    this.storage?.setItem(PROFILE_KEY, JSON.stringify(p));
  }

  /** Returns nothing; removes the profile from the device. */
  clear(): void {
    this.storage?.removeItem(PROFILE_KEY);
  }

  private read(): UserProfile | null {
    const raw = this.storage?.getItem(PROFILE_KEY);
    if (raw === null || raw === undefined) {
      return null;
    }
    try {
      const data: unknown = JSON.parse(raw);
      const parsed = UserProfileSchema.safeParse(data);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
}

export const DEFAULT_PROFILE_STORE = new LocalProfileStore();
