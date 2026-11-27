import type { PlatformDetectionResult } from '../shared/types';
import type { ATSAdapter } from './baseAdapter';

const GREENHOUSE_BOARD_HOST_PATTERN =
  /^(?:[a-z0-9-]+\.)*(?:boards|job-boards|my)(?:\.[a-z0-9-]+)*\.greenhouse\.io$/i;
const GREENHOUSE_PORTAL_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*my(?:\.[a-z0-9-]+)*\.greenhouse\.io$/i;
const GREENHOUSE_ACTION_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*greenhouse\.io$/i;

const GREENHOUSE_APPLY_PATH_PATTERN = /(?:^|\/)(?:apply|application)(?:\/|$)/i;
const GREENHOUSE_APPLY_HASH_PATTERN = /^#(?:app|application|application_form|application-form)$/i;
const GREENHOUSE_JOB_PATH_PATTERN =
  /^\/(?:[^/]+\/jobs\/[^/]+|jobs\/[^/]+|view_job|embed\/job_app)/i;

const GREENHOUSE_APPLICATION_SELECTORS = [
  'form#application_form',
  'form#application-form',
  'input[name="job_application[first_name]"]',
  'input[name^="job_application["]',
  '#application-form input#first_name',
  '#application-form input#email',
  '#application_form input#first_name',
  'form.application--form input#email',
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

function hasEmbeddedGreenhouseForm(doc: Document): boolean {
  if (typeof doc.querySelectorAll === 'function') {
    const forms = doc.querySelectorAll('form[action]');
    for (const form of Array.from(forms)) {
      const action = form.getAttribute('action');
      if (action) {
        const parsedAction = parseHttpUrl(action);
        if (parsedAction && GREENHOUSE_ACTION_HOST_PATTERN.test(parsedAction.hostname)) {
          return true;
        }
      }
    }

    const iframes = doc.querySelectorAll('iframe[src]');
    for (const iframe of Array.from(iframes)) {
      const src = iframe.getAttribute('src');
      if (src) {
        const parsedSrc = parseHttpUrl(src);
        if (parsedSrc && GREENHOUSE_BOARD_HOST_PATTERN.test(parsedSrc.hostname)) {
          return true;
        }
      }
    }
  } else {
    const form = doc.querySelector<HTMLFormElement>('form#application_form, form[action]');
    const action = form?.getAttribute('action');
    if (action) {
      const parsedAction = parseHttpUrl(action);
      if (parsedAction && GREENHOUSE_ACTION_HOST_PATTERN.test(parsedAction.hostname)) {
        return true;
      }
    }

    const iframe = doc.querySelector<HTMLIFrameElement>('iframe[src]');
    const src = iframe?.getAttribute('src');
    if (src) {
      const parsedSrc = parseHttpUrl(src);
      if (parsedSrc && GREENHOUSE_BOARD_HOST_PATTERN.test(parsedSrc.hostname)) {
        return true;
      }
    }
  }

  return false;
}

export class GreenhouseAdapter implements ATSAdapter {
  readonly id = 'greenhouse' as const;
  readonly displayName = 'Greenhouse';

  isSupportedUrl(url: string): boolean {
    const parsed = parseHttpUrl(url);
    if (!parsed) {
      return false;
    }

    return GREENHOUSE_BOARD_HOST_PATTERN.test(parsed.hostname);
  }

  getPageSignals(doc: Document | null, url: string): string[] {
    const signals: string[] = [];
    const parsed = parseHttpUrl(url);

    if (parsed && GREENHOUSE_BOARD_HOST_PATTERN.test(parsed.hostname)) {
      signals.push(`hostname:${parsed.hostname}`);

      if (
        GREENHOUSE_APPLY_PATH_PATTERN.test(parsed.pathname) ||
        GREENHOUSE_APPLY_HASH_PATTERN.test(parsed.hash)
      ) {
        signals.push('path:application-route');
      } else if (GREENHOUSE_JOB_PATH_PATTERN.test(parsed.pathname)) {
        signals.push('path:job-posting');
      } else if (GREENHOUSE_PORTAL_HOST_PATTERN.test(parsed.hostname)) {
        signals.push('path:candidate-portal');
      } else {
        signals.push('path:job-board');
      }
    }

    if (doc) {
      for (const selector of GREENHOUSE_APPLICATION_SELECTORS) {
        if (doc.querySelector(selector)) {
          signals.push(`dom:${selector}`);
          break;
        }
      }
      if (hasEmbeddedGreenhouseForm(doc)) {
        signals.push('dom:embedded-greenhouse-form');
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

    const isSupportedHost = GREENHOUSE_BOARD_HOST_PATTERN.test(parsed.hostname);
    const isPortalHost = GREENHOUSE_PORTAL_HOST_PATTERN.test(parsed.hostname);
    const signals = this.getPageSignals(doc, url);

    const hasDomApplicationForm = Boolean(
      doc &&
        (GREENHOUSE_APPLICATION_SELECTORS.some((selector) => doc.querySelector(selector)) ||
          hasEmbeddedGreenhouseForm(doc)),
    );

    if (!isSupportedHost) {
      if (hasDomApplicationForm) {
        return {
          platformId: this.id,
          platformName: this.displayName,
          isSupported: true,
          isApplicationPage: true,
          pageType: 'application',
          reason: 'Embedded Greenhouse application form detected on this page.',
          url,
          signals,
        };
      }
      return this.unsupportedResult(url, 'URL does not match a supported Greenhouse domain.');
    }

    const hasUrlApplySignal =
      GREENHOUSE_APPLY_PATH_PATTERN.test(parsed.pathname) ||
      GREENHOUSE_APPLY_HASH_PATTERN.test(parsed.hash);

    if (hasUrlApplySignal || hasDomApplicationForm) {
      return {
        platformId: this.id,
        platformName: this.displayName,
        isSupported: true,
        isApplicationPage: true,
        pageType: 'application',
        reason: hasDomApplicationForm
          ? 'Greenhouse domain and application form elements detected.'
          : 'Greenhouse application route (/apply) detected.',
        url,
        signals,
      };
    }

    const isJobPosting = GREENHOUSE_JOB_PATH_PATTERN.test(parsed.pathname);
    if (isPortalHost && !isJobPosting) {
      return {
        platformId: this.id,
        platformName: this.displayName,
        isSupported: true,
        isApplicationPage: false,
        pageType: 'portal',
        reason:
          'Greenhouse candidate portal detected, but no active job posting or application form was found.',
        url,
        signals,
      };
    }

    return {
      platformId: this.id,
      platformName: this.displayName,
      isSupported: true,
      isApplicationPage: false,
      pageType: 'job_board',
      reason: isJobPosting
        ? 'Greenhouse job posting detected, but no active application form was found.'
        : 'Greenhouse job board detected. Open a job posting or application form.',
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
