export type PlatformId = 'workday' | 'greenhouse' | 'unknown';

export type DetectedPageType = 'application' | 'job_board' | 'portal' | 'unsupported';

export interface PlatformDetectionResult {
  platformId: PlatformId;
  platformName: string;
  isSupported: boolean;
  isApplicationPage: boolean;
  pageType: DetectedPageType;
  reason: string;
  url: string;
  signals?: string[];
}

export type WorkAuthorizationOption = '' | 'yes' | 'no' | 'prefer_not_to_say';
export type SponsorshipOption = '' | 'no' | 'yes' | 'prefer_not_to_say';

export interface PersonalInfo {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface EducationRecord {
  id: string;
  institution: string;
  degree: string;
  specialization: string;
  startYear: string;
  graduationYear: string;
  cgpa: string;
}

export type EmploymentType =
  | ''
  | 'full_time'
  | 'part_time'
  | 'internship'
  | 'contract'
  | 'freelance'
  | 'other';

export interface EmploymentRecord {
  id: string;
  company: string;
  jobTitle: string;
  employmentType: EmploymentType;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  responsibilities: string;
}

export interface ProfessionalLinks {
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
}

export interface UserProfile {
  personal: PersonalInfo;
  education: EducationRecord[];
  employment: EmploymentRecord[];
  links: ProfessionalLinks;
  workAuthorized: WorkAuthorizationOption;
  sponsorshipRequired: SponsorshipOption;
  updatedAt?: string;
}

export type AnswerCategory =
  | 'work_authorization'
  | 'sponsorship'
  | 'education'
  | 'employment'
  | 'relocation'
  | 'notice_period'
  | 'availability'
  | 'salary_expectations'
  | 'general'
  | 'custom';

export interface ApplicationAnswer {
  id: string;
  question: string;
  answer: string;
  category: AnswerCategory;
  keywords: string[];
  requiresConfirmation: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ExtensionMessage =
  | { type: 'DETECT_PLATFORM' }
  | { type: 'GET_PLATFORM_STATUS' }
  | { type: 'PLATFORM_DETECTION_REPORT'; detection: PlatformDetectionResult };

export type ExtensionMessageResponse =
  | { ok: true; detection: PlatformDetectionResult }
  | { ok: false; error: string };
