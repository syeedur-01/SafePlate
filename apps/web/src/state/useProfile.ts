import { useCallback, useState } from 'react';
import { EMPTY_PROFILE, type UserProfile } from '@sp/contracts';
import { DEFAULT_PROFILE_STORE, type ProfileStore } from './profile-store';

export interface UseProfileResult {
  profile: UserProfile;
  saveProfile: (profile: UserProfile) => void;
  clearProfile: () => void;
}

/** Returns the current on-device profile plus save and clear actions. */
export function useProfile(store: ProfileStore = DEFAULT_PROFILE_STORE): UseProfileResult {
  const [profile, setProfile] = useState<UserProfile>(() => store.load());

  const saveProfile = useCallback(
    (next: UserProfile) => {
      store.save(next);
      setProfile(next);
    },
    [store],
  );

  const clearProfile = useCallback(() => {
    store.clear();
    setProfile(EMPTY_PROFILE);
  }, [store]);

  return { profile, saveProfile, clearProfile };
}
