import type { PlatformDetectionResult } from '../shared/types';
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
}
