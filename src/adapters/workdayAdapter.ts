import type { AutofillFieldResult, PlatformDetectionResult } from '../shared/types';
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
}

export type WorkdayFieldLookupResult =
  | { status: 'found'; element: HTMLInputElement; matchedBy: string }
  | { status: 'ambiguous' | 'not_found'; reason: string };

const DISALLOWED_INPUT_TYPES = new Set([
  'hidden',
  'checkbox',
  'radio',
  'file',
  'submit',
  'button',
  'reset',
  'image',
]);

const DISALLOWED_AUTOCOMPLETE_VALUES = new Set([
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
]);

const NEGATIVE_FIELD_PATTERN =
  /\b(?:last|middle|family|surname|full\s*name|fullname|preferred|emergency|reference|referral|manager|supervisor|email|phone|mobile|address|street|city|state|postal|zip|country)\b|(?:last|middle|family|surname|preferred)name/i;

const EXACT_FIRST_NAME_LABEL_PATTERN = /^(?:legal\s+)?(?:first|given)\s*name$/i;

const TIER1_FIRST_NAME_SELECTORS = [
  'input[data-automation-id="legalNameSection_firstName"]',
  '[data-automation-id="legalNameSection_firstName"] input',
  '[data-automation-id="formField-legalNameSection_firstName"] input',
  'input[name="legalName--firstName"]',
  'input[id="legalName--firstName"]',
  'input[id="name--legalName--firstName"]',
] as const;

const TIER2_FIRST_NAME_SELECTORS = [
  'input[data-automation-id="firstName"]',
  '[data-automation-id="formField-firstName"] input',
  'input[autocomplete="given-name"]',
  'input[name="firstName"]',
  'input[id="firstName"]',
  'input[name="first_name"]',
  'input[id="first_name"]',
  'input[name="first-name"]',
  'input[id="first-name"]',
] as const;

function escapeSelectorAttr(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

function normalizeLabelText(raw: string): string {
  return raw
    .replace(/\*/g, ' ')
    .replace(/\(required\)|\brequired\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function queryElements(root: Document, selector: string): Element[] {
  if (typeof root.querySelectorAll === 'function') {
    return Array.from(root.querySelectorAll(selector));
  }
  const single = root.querySelector(selector);
  return single ? [single] : [];
}

function getAccessibleLabel(doc: Document, input: HTMLInputElement): string {
  const ariaLabel = input.getAttribute?.('aria-label');
  if (ariaLabel && ariaLabel.trim()) {
    return ariaLabel.trim();
  }

  const labelledBy = input.getAttribute?.('aria-labelledby');
  if (labelledBy && labelledBy.trim()) {
    const parts = labelledBy
      .trim()
      .split(/\s+/)
      .map((id) => doc.querySelector(`#${escapeSelectorAttr(id)}`)?.textContent?.trim() ?? '')
      .filter((text) => text.length > 0);
    if (parts.length > 0) {
      return parts.join(' ');
    }
  }

  if (input.id) {
    const explicitLabel = doc.querySelector(`label[for="${escapeSelectorAttr(input.id)}"]`);
    if (explicitLabel?.textContent?.trim()) {
      return explicitLabel.textContent.trim();
    }
  }

  const wrappingLabel = typeof input.closest === 'function' ? input.closest('label') : null;
  if (wrappingLabel?.textContent?.trim()) {
    return wrappingLabel.textContent.trim();
  }

  const fieldWrapper =
    typeof input.closest === 'function'
      ? input.closest('[data-automation-id^="formField-"]')
      : null;
  if (fieldWrapper && typeof fieldWrapper.querySelectorAll === 'function') {
    const nestedInputs = fieldWrapper.querySelectorAll('input');
    if (nestedInputs.length === 1) {
      const formLabel =
        fieldWrapper.querySelector('[data-automation-id="formLabel"]') ??
        fieldWrapper.querySelector('label');
      if (formLabel?.textContent?.trim()) {
        return formLabel.textContent.trim();
      }
    }
  }

  return '';
}

function isEligibleFirstNameInput(doc: Document, candidate: Element): candidate is HTMLInputElement {
  const input = candidate as HTMLInputElement;
  if (input.tagName && input.tagName.toUpperCase() !== 'INPUT') {
    return false;
  }

  const rawType = (input.getAttribute?.('type') ?? input.type ?? 'text').toLowerCase();
  if (DISALLOWED_INPUT_TYPES.has(rawType)) {
    return false;
  }

  if (
    input.disabled ||
    input.readOnly ||
    input.hidden ||
    input.getAttribute?.('aria-hidden') === 'true'
  ) {
    return false;
  }

  const autocomplete = (input.getAttribute?.('autocomplete') ?? '').trim().toLowerCase();
  if (autocomplete && DISALLOWED_AUTOCOMPLETE_VALUES.has(autocomplete)) {
    return false;
  }

  const labelText = getAccessibleLabel(doc, input);
  const metadataToInspect = [
    input.id ?? '',
    input.name ?? '',
    input.getAttribute?.('data-automation-id') ?? '',
    input.getAttribute?.('aria-label') ?? '',
    labelText,
  ].join(' ');

  if (NEGATIVE_FIELD_PATTERN.test(metadataToInspect)) {
    return false;
  }

  return true;
}

function collectTierMatches(
  doc: Document,
  selectors: readonly string[],
): { elements: HTMLInputElement[]; matchedSelector: string } {
  const unique = new Set<HTMLInputElement>();
  let matchedSelector = '';

  for (const selector of selectors) {
    for (const el of queryElements(doc, selector)) {
      if (isEligibleFirstNameInput(doc, el)) {
        if (!matchedSelector) {
          matchedSelector = selector;
        }
        unique.add(el);
      }
    }
  }

  return { elements: Array.from(unique), matchedSelector };
}

export function findWorkdayFirstNameField(doc: Document): WorkdayFieldLookupResult {
  const tier1 = collectTierMatches(doc, TIER1_FIRST_NAME_SELECTORS);
  if (tier1.elements.length === 1 && tier1.elements[0]) {
    return { status: 'found', element: tier1.elements[0], matchedBy: tier1.matchedSelector };
  }
  if (tier1.elements.length > 1) {
    return {
      status: 'ambiguous',
      reason: 'Multiple First Name fields detected; unable to determine a unique target.',
    };
  }

  const tier2 = collectTierMatches(doc, TIER2_FIRST_NAME_SELECTORS);
  if (tier2.elements.length === 1 && tier2.elements[0]) {
    return { status: 'found', element: tier2.elements[0], matchedBy: tier2.matchedSelector };
  }
  if (tier2.elements.length > 1) {
    return {
      status: 'ambiguous',
      reason: 'Multiple First Name fields detected; unable to determine a unique target.',
    };
  }

  const labelMatches = new Set<HTMLInputElement>();
  for (const el of queryElements(doc, 'input')) {
    if (!isEligibleFirstNameInput(doc, el)) {
      continue;
    }
    const normalizedLabel = normalizeLabelText(getAccessibleLabel(doc, el));
    if (normalizedLabel && EXACT_FIRST_NAME_LABEL_PATTERN.test(normalizedLabel)) {
      labelMatches.add(el);
    }
  }

  const resolved = Array.from(labelMatches);
  if (resolved.length === 1 && resolved[0]) {
    return { status: 'found', element: resolved[0], matchedBy: 'label:first-name' };
  }
  if (resolved.length > 1) {
    return {
      status: 'ambiguous',
      reason: 'Multiple First Name fields detected; unable to determine a unique target.',
    };
  }

  return {
    status: 'not_found',
    reason: 'First Name field could not be identified.',
  };
}

function setInputValueAndDispatchEvents(input: HTMLInputElement, value: string): void {
  if (typeof input.focus === 'function') {
    input.focus();
  }

  const prototypeSetter =
    typeof HTMLInputElement !== 'undefined' && input instanceof HTMLInputElement
      ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      : undefined;

  if (prototypeSetter) {
    prototypeSetter.call(input, value);
  } else {
    input.value = value;
  }

  if (typeof input.dispatchEvent === 'function' && typeof Event === 'function') {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

export function autofillWorkdayFirstName(
  doc: Document,
  url: string,
  firstName: string,
  adapter: WorkdayAdapter = new WorkdayAdapter(),
): AutofillFieldResult {
  if (!adapter.isSupportedUrl(url)) {
    return {
      ok: false,
      status: 'unsupported_page',
      field: 'firstName',
      message: 'Autofill is only supported on Workday application pages.',
    };
  }

  const detection = adapter.detectFromDocument(doc, url);
  if (
    detection.platformId !== 'workday' ||
    !detection.isSupported ||
    !detection.isApplicationPage
  ) {
    return {
      ok: false,
      status: 'unsupported_page',
      field: 'firstName',
      message: 'Autofill is only supported on Workday application pages.',
    };
  }

  const trimmedFirstName = firstName.trim();
  if (!trimmedFirstName) {
    return {
      ok: false,
      status: 'missing_first_name',
      field: 'firstName',
      message: 'First Name is missing from your profile.',
    };
  }

  const lookup = findWorkdayFirstNameField(doc);
  if (lookup.status !== 'found') {
    return {
      ok: false,
      status: lookup.status === 'ambiguous' ? 'field_ambiguous' : 'field_not_found',
      field: 'firstName',
      message: lookup.reason,
    };
  }

  const currentValue = (lookup.element.value ?? '').trim();
  if (currentValue.length > 0) {
    return {
      ok: false,
      status: 'already_populated',
      field: 'firstName',
      message: 'Field already contains a value.',
      matchedBy: lookup.matchedBy,
    };
  }

  try {
    setInputValueAndDispatchEvents(lookup.element, trimmedFirstName);
    return {
      ok: true,
      status: 'filled',
      field: 'firstName',
      message: 'First Name filled successfully.',
      matchedBy: lookup.matchedBy,
    };
  } catch {
    return {
      ok: false,
      status: 'failed',
      field: 'firstName',
      message: 'Autofill failed.',
    };
  }
}
