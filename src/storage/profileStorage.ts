import { DEFAULT_USER_PROFILE, STORAGE_KEYS } from '../shared/constants';
import type { UserProfile } from '../shared/types';

/**
 * Reads the locally stored user profile from chrome.storage.local.
 * Returns defaults merged with any saved fields.
 */
export async function getUserProfile(): Promise<UserProfile> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PROFILE);
  const stored = result[STORAGE_KEYS.USER_PROFILE] as Partial<UserProfile> | undefined;

  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_USER_PROFILE };
  }

  return {
    ...DEFAULT_USER_PROFILE,
    ...stored,
  };
}

/**
 * Persists the user profile to chrome.storage.local with an updated timestamp.
 */
export async function saveUserProfile(profile: UserProfile): Promise<UserProfile> {
  const nextProfile: UserProfile = {
    ...DEFAULT_USER_PROFILE,
    ...profile,
    updatedAt: new Date().toISOString(),
  };

  await chrome.storage.local.set({
    [STORAGE_KEYS.USER_PROFILE]: nextProfile,
  });

  return nextProfile;
}

/**
 * Removes the saved user profile from chrome.storage.local.
 */
export async function clearUserProfile(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.USER_PROFILE);
}
