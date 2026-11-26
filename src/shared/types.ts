export type PlatformId = 'workday' | 'greenhouse' | 'unknown';

export interface PlatformDetectionResult {
  detected: boolean;
  platform: PlatformId;
  label: string;
  url?: string;
}

export type WorkAuthorizationOption = '' | 'yes' | 'no' | 'prefer_not_to_say';
export type SponsorshipOption = '' | 'no' | 'yes' | 'prefer_not_to_say';

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  workAuthorized: WorkAuthorizationOption;
  sponsorshipRequired: SponsorshipOption;
  updatedAt?: string;
}

export type ExtensionMessage =
  | { type: 'DETECT_PLATFORM' }
  | { type: 'GET_PLATFORM_STATUS' };

export type ExtensionMessageResponse =
  | { ok: true; detection: PlatformDetectionResult }
  | { ok: false; error: string };
