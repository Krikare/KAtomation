import type {
  AnswerCategory,
  EmploymentType,
  PersonalInfo,
  PlatformDetectionResult,
  ProfessionalLinks,
  UserProfile,
} from './types';

export const PRODUCT_NAME = 'K{Atomation}';

export const STORAGE_KEYS = {
  USER_PROFILE: 'katomation_user_profile',
  APPLICATION_ANSWERS: 'katomation_application_answers',
} as const;

export const DEFAULT_PERSONAL_INFO: PersonalInfo = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
};

export const DEFAULT_PROFESSIONAL_LINKS: ProfessionalLinks = {
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  personal: { ...DEFAULT_PERSONAL_INFO },
  education: [],
  employment: [],
  links: { ...DEFAULT_PROFESSIONAL_LINKS },
  workAuthorized: '',
  sponsorshipRequired: '',
};

export const EMPLOYMENT_TYPE_LABELS: Readonly<Record<Exclude<EmploymentType, ''>, string>> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  internship: 'Internship',
  contract: 'Contract',
  freelance: 'Freelance',
  other: 'Other',
};

export const ANSWER_CATEGORY_LABELS: Readonly<Record<AnswerCategory, string>> = {
  work_authorization: 'Work authorization',
  sponsorship: 'Visa sponsorship',
  education: 'Education',
  employment: 'Employment',
  relocation: 'Relocation',
  notice_period: 'Notice period',
  availability: 'Availability',
  salary_expectations: 'Salary expectations',
  general: 'General questions',
  custom: 'Custom questions',
};

export const INITIAL_DETECTION_STATE: PlatformDetectionResult = {
  platformId: 'unknown',
  platformName: 'Unknown',
  isSupported: false,
  isApplicationPage: false,
  pageType: 'unsupported',
  reason: 'Unsupported website or no active recruitment page detected.',
  url: '',
};
