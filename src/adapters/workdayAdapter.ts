import type { ATSAdapter } from './baseAdapter';

const WORKDAY_HOST_PATTERNS = [
  /(^|\.)myworkdayjobs\.com$/i,
  /(^|\.)myworkday\.com$/i,
];

export class WorkdayAdapter implements ATSAdapter {
  readonly id = 'workday' as const;
  readonly displayName = 'Workday';

  matchesUrl(url: string): boolean {
    try {
      const { hostname } = new URL(url);
      return WORKDAY_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
    } catch {
      return false;
    }
  }

  detectPage(doc: Document, url: string): boolean {
    if (this.matchesUrl(url)) {
      return true;
    }

    return Boolean(doc.querySelector('[data-automation-id="applyManually"], [data-automation-id="workdayApplication"]'));
  }
}
