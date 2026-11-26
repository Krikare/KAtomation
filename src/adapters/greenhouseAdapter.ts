import type { ATSAdapter } from './baseAdapter';

const GREENHOUSE_HOST_PATTERNS = [
  /(^|\.)greenhouse\.io$/i,
];

export class GreenhouseAdapter implements ATSAdapter {
  readonly id = 'greenhouse' as const;
  readonly displayName = 'Greenhouse';

  matchesUrl(url: string): boolean {
    try {
      const { hostname } = new URL(url);
      return GREENHOUSE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
    } catch {
      return false;
    }
  }

  detectPage(doc: Document, url: string): boolean {
    if (this.matchesUrl(url)) {
      return true;
    }

    return Boolean(doc.querySelector('#application_form, form[action*="greenhouse.io"]'));
  }
}
