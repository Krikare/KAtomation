import type { PlatformDetectionResult, UserProfile } from './types';

export const PRODUCT_NAME = 'K{Atomation}';

export const STORAGE_KEYS = {
  USER_PROFILE: 'katomation_user_profile',
} as const;

export const DEFAULT_USER_PROFILE: UserProfile = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  location: '',
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  workAuthorized: '',
  sponsorshipRequired: '',
};

export const INITIAL_DETECTION_STATE: PlatformDetectionResult = {
  detected: false,
  platform: 'unknown',
  label: 'Not detected',
};
