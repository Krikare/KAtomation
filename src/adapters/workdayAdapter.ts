import type {
  AutofillFieldResult,
  PlatformDetectionResult,
  WorkdayAutofillBatchResult,
  WorkdayBasicProfileValues,
} from '../shared/types';
import {
  type FieldLookupResult,
  type FieldMatcherConfig,
  findUniqueInputField,
  populateMatchedField,
} from './autofillUtils';
import type { ATSAdapter } from './baseAdapter';

const WORKDAY_JOBS_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*myworkdayjobs\.com$/i;
const WORKDAY_PORTAL_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*myworkday\.com$/i;

const WORKDAY_RECRUITING_PATH_PATTERN =
  /\/(?:recruiting|jobs?|careers|candidate|wday\/cxs|d\/task)(?:\/|$)/i;
const WORKDAY_APPLICATION_PATH_PATTERN = /(?:^|\/)apply(?:\/|$)/i;
const WORKDAY_APPLICATION_HASH_PATTERN = /^#\/?(?:.*\/)?apply(?:\/|\?|$)/i;

const WORKDAY_APPLICATION_SELECTORS = [
  '[data-automation-id="applyManually"]',
  '[data-automation-id="workdayApplication"]',
  '[data-automation-id="applyFlow"]',
  '[data-automation-id="contactInformationPage"]',
  '[data-automation-id="myExperiencePage"]',
  '[data-automation-id="applicationQuestionsPage"]',
  '[data-automation-id="voluntaryDisclosuresPage"]',
  '[data-automation-id="selfIdentificationPage"]',
  '[data-automation-id^="formField-"]',
] as const;

const WORKDAY_RECRUITING_SELECTORS = [
  '[data-automation-id="jobPostingPage"]',
  '[data-automation-id="jobRequisitionTitle"]',
  '[data-automation-id="adventureButton"]',
  '[data-automation-id="jobPostingDescription"]',
] as const;

function parseHttpUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export class WorkdayAdapter implements ATSAdapter {
  readonly id = 'workday' as const;
  readonly displayName = 'Workday';

  isSupportedUrl(url: string): boolean {
    const parsed = parseHttpUrl(url);
    if (!parsed) {
      return false;
    }

    return (
      WORKDAY_JOBS_HOST_PATTERN.test(parsed.hostname) ||
      WORKDAY_PORTAL_HOST_PATTERN.test(parsed.hostname)
    );
  }

  getPageSignals(doc: Document | null, url: string): string[] {
    const signals: string[] = [];
    const parsed = parseHttpUrl(url);

    if (parsed) {
      if (WORKDAY_JOBS_HOST_PATTERN.test(parsed.hostname)) {
        signals.push(`hostname:${parsed.hostname} (myworkdayjobs.com)`);
      } else if (WORKDAY_PORTAL_HOST_PATTERN.test(parsed.hostname)) {
        signals.push(`hostname:${parsed.hostname} (myworkday.com)`);
      }

      if (
        WORKDAY_APPLICATION_PATH_PATTERN.test(parsed.pathname) ||
        WORKDAY_APPLICATION_HASH_PATTERN.test(parsed.hash)
      ) {
        signals.push('path:application-route');
      } else if (WORKDAY_RECRUITING_PATH_PATTERN.test(parsed.pathname)) {
        signals.push('path:recruitment-route');
      }
    }

    if (doc) {
      for (const selector of WORKDAY_APPLICATION_SELECTORS) {
        if (doc.querySelector(selector)) {
          signals.push(`dom:${selector}`);
          break;
        }
      }
      for (const selector of WORKDAY_RECRUITING_SELECTORS) {
        if (doc.querySelector(selector)) {
          signals.push(`dom:${selector}`);
          break;
        }
      }
    }

    return signals;
  }

  detectFromUrl(url: string): PlatformDetectionResult {
    return this.evaluate(null, url);
  }

  detectFromDocument(doc: Document, url: string): PlatformDetectionResult {
    return this.evaluate(doc, url);
  }

  private evaluate(doc: Document | null, url: string): PlatformDetectionResult {
    const parsed = parseHttpUrl(url);
    if (!parsed) {
      return this.unsupportedResult(url, 'URL is missing or malformed.');
    }

    const isJobsHost = WORKDAY_JOBS_HOST_PATTERN.test(parsed.hostname);
    const isPortalHost = WORKDAY_PORTAL_HOST_PATTERN.test(parsed.hostname);
    const signals = this.getPageSignals(doc, url);

    const hasDomApplicationSignal = Boolean(
      doc && WORKDAY_APPLICATION_SELECTORS.some((selector) => doc.querySelector(selector)),
    );
    const hasDomRecruitingSignal = Boolean(
      doc && WORKDAY_RECRUITING_SELECTORS.some((selector) => doc.querySelector(selector)),
    );

    if (!isJobsHost && !isPortalHost) {
      if (hasDomApplicationSignal) {
        return {
          platformId: this.id,
          platformName: this.displayName,
          isSupported: true,
          isApplicationPage: true,
          pageType: 'application',
          reason: 'Workday application form elements were detected on this page.',
          url,
          signals,
        };
      }
      return this.unsupportedResult(url, 'URL does not match a supported Workday domain.');
    }

    const hasUrlApplicationSignal =
      WORKDAY_APPLICATION_PATH_PATTERN.test(parsed.pathname) ||
      WORKDAY_APPLICATION_HASH_PATTERN.test(parsed.hash);
    const hasUrlRecruitingSignal = WORKDAY_RECRUITING_PATH_PATTERN.test(parsed.pathname);

    if (hasUrlApplicationSignal || hasDomApplicationSignal) {
      return {
        platformId: this.id,
        platformName: this.displayName,
        isSupported: true,
        isApplicationPage: true,
        pageType: 'application',
        reason: hasDomApplicationSignal
          ? 'Workday domain and application form controls detected.'
          : 'Workday recruitment domain and application route (/apply) detected.',
        url,
        signals,
      };
    }

    if (isJobsHost || hasUrlRecruitingSignal || hasDomRecruitingSignal) {
      return {
        platformId: this.id,
        platformName: this.displayName,
        isSupported: true,
        isApplicationPage: false,
        pageType: 'job_board',
        reason:
          'Workday careers or job listing page detected. Open an application form to detect form fields.',
        url,
        signals,
      };
    }

    return {
      platformId: this.id,
      platformName: this.displayName,
      isSupported: true,
      isApplicationPage: false,
      pageType: 'portal',
      reason:
        'Workday tenant portal domain detected, but no recruitment or application page signals were found.',
      url,
      signals,
    };
  }

  private unsupportedResult(url: string, reason: string): PlatformDetectionResult {
    return {
      platformId: 'unknown',
      platformName: 'Unknown',
      isSupported: false,
      isApplicationPage: false,
      pageType: 'unsupported',
      reason,
      url,
      signals: [],
    };
  }

  autofillFirstName(doc: Document, url: string, firstName: string): AutofillFieldResult {
    return autofillWorkdayFirstName(doc, url, firstName, this);
  }

  autofillLastName(doc: Document, url: string, lastName: string): AutofillFieldResult {
    return autofillWorkdayLastName(doc, url, lastName, this);
  }

  autofillEmail(doc: Document, url: string, email: string): AutofillFieldResult {
    return autofillWorkdayEmail(doc, url, email, this);
  }

  autofillBasicFields(
    doc: Document,
    url: string,
    values: WorkdayBasicProfileValues,
  ): WorkdayAutofillBatchResult {
    return autofillWorkdayFields(doc, url, values, this);
  }
}

export type WorkdayFieldLookupResult = FieldLookupResult;

const WORKDAY_FIRST_NAME_CONFIG: FieldMatcherConfig = {
  field: 'firstName',
  fieldLabel: 'First Name',
  tier1Selectors: [
    'input[data-automation-id="legalNameSection_firstName"]',
    '[data-automation-id="legalNameSection_firstName"] input',
    '[data-automation-id="formField-legalNameSection_firstName"] input',
    'input[name="legalName--firstName"]',
    'input[id="legalName--firstName"]',
    'input[id="name--legalName--firstName"]',
  ],
  tier2Selectors: [
    'input[data-automation-id="firstName"]',
    '[data-automation-id="formField-firstName"] input',
    'input[autocomplete="given-name"]',
    'input[name="firstName"]',
    'input[id="firstName"]',
    'input[name="first_name"]',
    'input[id="first_name"]',
    'input[name="first-name"]',
    'input[id="first-name"]',
  ],
  exactLabelPattern: /^(?:legal\s+)?(?:first|given)\s*name$/i,
  negativePattern:
    /\b(?:last|middle|family|surname|full\s*name|fullname|preferred|emergency|reference|referral|manager|supervisor|email|phone|mobile|address|street|city|state|postal|zip|country)\b|(?:last|middle|family|surname|preferred)name/i,
  disallowedAutocomplete: new Set([
    'family-name',
    'additional-name',
    'name',
    'email',
    'tel',
    'organization',
    'street-address',
    'postal-code',
    'username',
    'new-password',
    'current-password',
  ]),
};

const WORKDAY_LAST_NAME_CONFIG: FieldMatcherConfig = {
  field: 'lastName',
  fieldLabel: 'Last Name',
  tier1Selectors: [
    'input[data-automation-id="legalNameSection_lastName"]',
    '[data-automation-id="legalNameSection_lastName"] input',
    '[data-automation-id="formField-legalNameSection_lastName"] input',
    'input[name="legalName--lastName"]',
    'input[id="legalName--lastName"]',
    'input[id="name--legalName--lastName"]',
  ],
  tier2Selectors: [
    'input[data-automation-id="lastName"]',
    '[data-automation-id="formField-lastName"] input',
    'input[autocomplete="family-name"]',
    'input[name="lastName"]',
    'input[id="lastName"]',
    'input[name="last_name"]',
    'input[id="last_name"]',
    'input[name="last-name"]',
    'input[id="last-name"]',
    'input[name="surname"]',
    'input[id="surname"]',
  ],
  exactLabelPattern: /^(?:legal\s+)?(?:last|family)\s*name$|^surname$/i,
  negativePattern:
    /\b(?:first|middle|given|full\s*name|fullname|preferred|emergency|reference|referral|manager|supervisor|guardian|spouse|email|phone|mobile|address|street|city|state|postal|zip|country)\b|(?:first|middle|given|preferred)name/i,
  disallowedAutocomplete: new Set([
    'given-name',
    'additional-name',
    'name',
    'email',
    'tel',
    'organization',
    'street-address',
    'postal-code',
    'username',
    'new-password',
    'current-password',
  ]),
};

const WORKDAY_EMAIL_CONFIG: FieldMatcherConfig = {
  field: 'email',
  fieldLabel: 'Email',
  tier1Selectors: [
    'input[data-automation-id="email"]',
    '[data-automation-id="email"] input',
    '[data-automation-id="formField-email"] input',
    'input[data-automation-id="contactInformation_email"]',
    '[data-automation-id="contactInformation_email"] input',
    'input[name="email"]',
    'input[id="email"]',
    'input[name="emailAddress"]',
    'input[id="emailAddress"]',
    'input[name="primaryEmail"]',
    'input[id="primaryEmail"]',
  ],
  tier2Selectors: [
    'input[autocomplete="email"]',
    'input[type="email"]',
    'input[name="email_address"]',
    'input[id="email_address"]',
    'input[name="email-address"]',
    'input[id="email-address"]',
  ],
  exactLabelPattern: /^(?:primary\s+)?e-?mail(?:\s+address)?$/i,
  negativePattern:
    /\b(?:secondary|alternate|alternative|other|backup|confirm|verify|reenter|re-enter|retype|emergency|reference|referral|manager|supervisor|recruiter|guardian|spouse|work\s*email|company\s*email|password|username|phone|mobile|first|last|middle|street\s*address|mailing\s*address|home\s*address|postal\s*address)\b|(?:secondary|alternate|alternative|backup|confirm|emergency|reference|referral|work|company|contact)email/i,
  allowedInputTypes: new Set(['', 'text', 'email']),
  disallowedAutocomplete: new Set([
    'given-name',
    'family-name',
    'additional-name',
    'name',
    'tel',
    'organization',
    'street-address',
    'postal-code',
    'username',
    'new-password',
    'current-password',
  ]),
};

function isWorkdayApplicationPage(
  doc: Document,
  url: string,
  adapter: WorkdayAdapter,
): boolean {
  if (!adapter.isSupportedUrl(url)) {
    return false;
  }
  const detection = adapter.detectFromDocument(doc, url);
  return (
    detection.platformId === 'workday' &&
    detection.isSupported &&
    detection.isApplicationPage
  );
}

export function findWorkdayFirstNameField(doc: Document): WorkdayFieldLookupResult {
  return findUniqueInputField(doc, WORKDAY_FIRST_NAME_CONFIG);
}

export function findWorkdayLastNameField(doc: Document): WorkdayFieldLookupResult {
  return findUniqueInputField(doc, WORKDAY_LAST_NAME_CONFIG);
}

export function findWorkdayEmailField(doc: Document): WorkdayFieldLookupResult {
  return findUniqueInputField(doc, WORKDAY_EMAIL_CONFIG);
}

export function autofillWorkdayFirstName(
  doc: Document,
  url: string,
  firstName: string,
  adapter: WorkdayAdapter = new WorkdayAdapter(),
): AutofillFieldResult {
  if (!isWorkdayApplicationPage(doc, url, adapter)) {
    return {
      ok: false,
      status: 'unsupported_page',
      field: 'firstName',
      label: 'First Name',
      message: 'Autofill is only supported on Workday application pages.',
    };
  }

  return populateMatchedField(doc, firstName, WORKDAY_FIRST_NAME_CONFIG, 'missing_first_name');
}

export function autofillWorkdayLastName(
  doc: Document,
  url: string,
  lastName: string,
  adapter: WorkdayAdapter = new WorkdayAdapter(),
): AutofillFieldResult {
  if (!isWorkdayApplicationPage(doc, url, adapter)) {
    return {
      ok: false,
      status: 'unsupported_page',
      field: 'lastName',
      label: 'Last Name',
      message: 'Autofill is only supported on Workday application pages.',
    };
  }

  return populateMatchedField(doc, lastName, WORKDAY_LAST_NAME_CONFIG, 'missing_value');
}

export function autofillWorkdayEmail(
  doc: Document,
  url: string,
  email: string,
  adapter: WorkdayAdapter = new WorkdayAdapter(),
): AutofillFieldResult {
  if (!isWorkdayApplicationPage(doc, url, adapter)) {
    return {
      ok: false,
      status: 'unsupported_page',
      field: 'email',
      label: 'Email',
      message: 'Autofill is only supported on Workday application pages.',
    };
  }

  return populateMatchedField(doc, email, WORKDAY_EMAIL_CONFIG, 'missing_value');
}

export function autofillWorkdayFields(
  doc: Document,
  url: string,
  values: WorkdayBasicProfileValues,
  adapter: WorkdayAdapter = new WorkdayAdapter(),
): WorkdayAutofillBatchResult {
  if (!isWorkdayApplicationPage(doc, url, adapter)) {
    return {
      ok: false,
      results: [
        {
          ok: false,
          status: 'unsupported_page',
          field: 'firstName',
          label: 'First Name',
          message: 'Unsupported page.',
        },
        {
          ok: false,
          status: 'unsupported_page',
          field: 'lastName',
          label: 'Last Name',
          message: 'Unsupported page.',
        },
        {
          ok: false,
          status: 'unsupported_page',
          field: 'email',
          label: 'Email',
          message: 'Unsupported page.',
        },
      ],
    };
  }

  const results: AutofillFieldResult[] = [
    populateMatchedField(doc, values.firstName, WORKDAY_FIRST_NAME_CONFIG, 'missing_first_name'),
    populateMatchedField(doc, values.lastName, WORKDAY_LAST_NAME_CONFIG, 'missing_value'),
    populateMatchedField(doc, values.email, WORKDAY_EMAIL_CONFIG, 'missing_value'),
  ];

  return {
    ok: results.some((item) => item.ok),
    results,
  };
}
