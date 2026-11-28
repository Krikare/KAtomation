import {
  ANSWER_CATEGORY_LABELS,
  DEFAULT_PERSONAL_INFO,
  DEFAULT_PROFESSIONAL_LINKS,
  DEFAULT_USER_PROFILE,
  EMPLOYMENT_TYPE_LABELS,
  STORAGE_KEYS,
} from '../shared/constants';
import type {
  AnswerCategory,
  ApplicationAnswer,
  EducationRecord,
  EmploymentRecord,
  EmploymentType,
  PersonalInfo,
  ProfessionalLinks,
  SponsorshipOption,
  UserProfile,
  WorkAuthorizationOption,
  WorkdayBasicProfileValues,
} from '../shared/types';

interface LegacyMilestone1Profile {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  location?: unknown;
  linkedinUrl?: unknown;
  githubUrl?: unknown;
  portfolioUrl?: unknown;
  workAuthorized?: unknown;
  sponsorshipRequired?: unknown;
  updatedAt?: unknown;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizePersonalInfo(
  rawPersonal: unknown,
  legacy: LegacyMilestone1Profile,
): PersonalInfo {
  const source =
    rawPersonal && typeof rawPersonal === 'object'
      ? (rawPersonal as Partial<Record<keyof PersonalInfo, unknown>>)
      : {};

  return {
    firstName: asString(source.firstName ?? legacy.firstName),
    middleName: asString(source.middleName),
    lastName: asString(source.lastName ?? legacy.lastName),
    email: asString(source.email ?? legacy.email),
    phone: asString(source.phone ?? legacy.phone),
    address: asString(source.address),
    city: asString(source.city ?? legacy.location),
    state: asString(source.state),
    country: asString(source.country),
    postalCode: asString(source.postalCode),
  };
}

function normalizeLinks(
  rawLinks: unknown,
  legacy: LegacyMilestone1Profile,
): ProfessionalLinks {
  const source =
    rawLinks && typeof rawLinks === 'object'
      ? (rawLinks as Partial<Record<keyof ProfessionalLinks, unknown>>)
      : {};

  return {
    linkedinUrl: asString(source.linkedinUrl ?? legacy.linkedinUrl),
    githubUrl: asString(source.githubUrl ?? legacy.githubUrl),
    portfolioUrl: asString(source.portfolioUrl ?? legacy.portfolioUrl),
  };
}

function normalizeEducationRecord(raw: unknown): EducationRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const item = raw as Partial<Record<keyof EducationRecord, unknown>>;
  return {
    id: asString(item.id) || generateId('edu'),
    institution: asString(item.institution),
    degree: asString(item.degree),
    specialization: asString(item.specialization),
    startYear: asString(item.startYear),
    graduationYear: asString(item.graduationYear),
    cgpa: asString(item.cgpa),
  };
}

function normalizeEmploymentType(value: unknown): EmploymentType {
  if (typeof value === 'string' && value in EMPLOYMENT_TYPE_LABELS) {
    return value as EmploymentType;
  }
  return '';
}

function normalizeEmploymentRecord(raw: unknown): EmploymentRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const item = raw as Partial<Record<keyof EmploymentRecord, unknown>>;
  const currentlyWorking = Boolean(item.currentlyWorking);
  return {
    id: asString(item.id) || generateId('emp'),
    company: asString(item.company),
    jobTitle: asString(item.jobTitle),
    employmentType: normalizeEmploymentType(item.employmentType),
    startDate: asString(item.startDate),
    endDate: currentlyWorking ? '' : asString(item.endDate),
    currentlyWorking,
    responsibilities: asString(item.responsibilities),
  };
}

function normalizeWorkAuthorization(value: unknown): WorkAuthorizationOption {
  if (value === 'yes' || value === 'no' || value === 'prefer_not_to_say') {
    return value;
  }
  return '';
}

function normalizeSponsorship(value: unknown): SponsorshipOption {
  if (value === 'no' || value === 'yes' || value === 'prefer_not_to_say') {
    return value;
  }
  return '';
}

function normalizeUserProfile(raw: unknown): UserProfile {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_USER_PROFILE,
      personal: { ...DEFAULT_PERSONAL_INFO },
      education: [],
      employment: [],
      links: { ...DEFAULT_PROFESSIONAL_LINKS },
    };
  }

  const record = raw as Record<string, unknown>;
  const legacy = record as LegacyMilestone1Profile;

  const education = Array.isArray(record.education)
    ? record.education
        .map(normalizeEducationRecord)
        .filter((item): item is EducationRecord => item !== null)
    : [];

  const employment = Array.isArray(record.employment)
    ? record.employment
        .map(normalizeEmploymentRecord)
        .filter((item): item is EmploymentRecord => item !== null)
    : [];

  const normalized: UserProfile = {
    personal: normalizePersonalInfo(record.personal, legacy),
    education,
    employment,
    links: normalizeLinks(record.links, legacy),
    workAuthorized: normalizeWorkAuthorization(record.workAuthorized),
    sponsorshipRequired: normalizeSponsorship(record.sponsorshipRequired),
  };

  if (typeof record.updatedAt === 'string' && record.updatedAt.length > 0) {
    normalized.updatedAt = record.updatedAt;
  }

  return normalized;
}

function normalizeAnswerCategory(value: unknown): AnswerCategory {
  if (typeof value === 'string' && value in ANSWER_CATEGORY_LABELS) {
    return value as AnswerCategory;
  }
  return 'custom';
}

function normalizeApplicationAnswer(raw: unknown): ApplicationAnswer | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const item = raw as Partial<Record<keyof ApplicationAnswer, unknown>>;
  const now = new Date().toISOString();
  const keywords = Array.isArray(item.keywords)
    ? item.keywords
        .filter((kw): kw is string => typeof kw === 'string')
        .map((kw) => kw.trim())
        .filter((kw) => kw.length > 0)
    : [];

  return {
    id: asString(item.id) || generateId('ans'),
    question: asString(item.question),
    answer: asString(item.answer),
    category: normalizeAnswerCategory(item.category),
    keywords,
    requiresConfirmation: Boolean(item.requiresConfirmation),
    createdAt: asString(item.createdAt) || now,
    updatedAt: asString(item.updatedAt) || now,
  };
}

function formatStorageError(action: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`Storage error while ${action}: ${detail}`);
}

export type WorkdayBasicProfileLookup =
  | { ok: true; values: WorkdayBasicProfileValues }
  | {
      ok: false;
      status: 'missing_profile' | 'storage_error';
      message: string;
    };

/**
 * Reads First Name, Last Name, and Email from the existing user profile key in chrome.storage.local.
 * Handles missing profile and storage errors without introducing duplicate storage keys.
 */
export async function getWorkdayBasicProfileValues(): Promise<WorkdayBasicProfileLookup> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PROFILE);
    const raw = result[STORAGE_KEYS.USER_PROFILE];
    if (!raw || typeof raw !== 'object') {
      return {
        ok: false,
        status: 'missing_profile',
        message: 'No saved profile found. Open Settings to add your profile details.',
      };
    }

    const profile = normalizeUserProfile(raw);
    return {
      ok: true,
      values: {
        firstName: profile.personal.firstName.trim(),
        lastName: profile.personal.lastName.trim(),
        email: profile.personal.email.trim(),
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 'storage_error',
      message: formatStorageError('loading profile values', error).message,
    };
  }
}

export type SavedFirstNameLookup =
  | { ok: true; firstName: string }
  | {
      ok: false;
      status: 'missing_profile' | 'missing_first_name' | 'storage_error';
      message: string;
    };

/**
 * Reads only the saved First Name from the existing user profile key in chrome.storage.local.
 * Handles missing profile, missing/empty First Name, and storage errors cleanly.
 */
export async function getSavedFirstName(): Promise<SavedFirstNameLookup> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PROFILE);
    const raw = result[STORAGE_KEYS.USER_PROFILE];
    if (!raw || typeof raw !== 'object') {
      return {
        ok: false,
        status: 'missing_profile',
        message: 'No saved profile found. Open Settings to add your First Name.',
      };
    }

    const profile = normalizeUserProfile(raw);
    const firstName = profile.personal.firstName.trim();
    if (!firstName) {
      return {
        ok: false,
        status: 'missing_first_name',
        message: 'First Name is missing from your profile.',
      };
    }

    return { ok: true, firstName };
  } catch (error) {
    return {
      ok: false,
      status: 'storage_error',
      message: formatStorageError('loading First Name', error).message,
    };
  }
}

/**
 * Reads the locally stored user profile from chrome.storage.local.
 * Preserves Milestone 1 fields and provides safe defaults for newly introduced fields.
 */
export async function getUserProfile(): Promise<UserProfile> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PROFILE);
    return normalizeUserProfile(result[STORAGE_KEYS.USER_PROFILE]);
  } catch (error) {
    throw formatStorageError('loading user profile', error);
  }
}

/**
 * Persists the user profile to chrome.storage.local without altering other storage keys.
 */
export async function saveUserProfile(profile: UserProfile): Promise<UserProfile> {
  try {
    const existingResult = await chrome.storage.local.get(STORAGE_KEYS.USER_PROFILE);
    const existingProfile = normalizeUserProfile(existingResult[STORAGE_KEYS.USER_PROFILE]);

    const normalizedInput = normalizeUserProfile(profile);
    const nextProfile: UserProfile = {
      personal: { ...DEFAULT_PERSONAL_INFO, ...normalizedInput.personal },
      education: normalizedInput.education,
      employment: normalizedInput.employment,
      links: { ...DEFAULT_PROFESSIONAL_LINKS, ...normalizedInput.links },
      workAuthorized: normalizedInput.workAuthorized || existingProfile.workAuthorized,
      sponsorshipRequired:
        normalizedInput.sponsorshipRequired || existingProfile.sponsorshipRequired,
      updatedAt: new Date().toISOString(),
    };

    await chrome.storage.local.set({
      [STORAGE_KEYS.USER_PROFILE]: nextProfile,
    });

    return nextProfile;
  } catch (error) {
    throw formatStorageError('saving user profile', error);
  }
}

/**
 * Removes only the user profile key from chrome.storage.local.
 * Saved application answers are preserved.
 */
export async function clearUserProfile(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEYS.USER_PROFILE);
  } catch (error) {
    throw formatStorageError('clearing user profile', error);
  }
}

/**
 * Reads saved application answers from chrome.storage.local.
 */
export async function getApplicationAnswers(): Promise<ApplicationAnswer[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.APPLICATION_ANSWERS);
    const raw = result[STORAGE_KEYS.APPLICATION_ANSWERS];
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map(normalizeApplicationAnswer)
      .filter((item): item is ApplicationAnswer => item !== null);
  } catch (error) {
    throw formatStorageError('loading application answers', error);
  }
}

/**
 * Persists the application answers array to chrome.storage.local without
 * affecting the stored user profile.
 */
export async function saveApplicationAnswers(
  answers: ApplicationAnswer[],
): Promise<ApplicationAnswer[]> {
  try {
    const normalized = answers
      .map(normalizeApplicationAnswer)
      .filter((item): item is ApplicationAnswer => item !== null);

    await chrome.storage.local.set({
      [STORAGE_KEYS.APPLICATION_ANSWERS]: normalized,
    });

    return normalized;
  } catch (error) {
    throw formatStorageError('saving application answers', error);
  }
}
