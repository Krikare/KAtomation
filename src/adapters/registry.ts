import { INITIAL_DETECTION_STATE } from '../shared/constants';
import type { PlatformDetectionResult } from '../shared/types';
import type { ATSAdapter } from './baseAdapter';
import { GreenhouseAdapter } from './greenhouseAdapter';
import { WorkdayAdapter } from './workdayAdapter';

export const ATS_ADAPTERS: readonly ATSAdapter[] = [
  new WorkdayAdapter(),
  new GreenhouseAdapter(),
];

export function detectPlatformFromUrl(url: string): PlatformDetectionResult {
  for (const adapter of ATS_ADAPTERS) {
    if (adapter.matchesUrl(url)) {
      return {
        detected: true,
        platform: adapter.id,
        label: adapter.displayName,
        url,
      };
    }
  }

  return { ...INITIAL_DETECTION_STATE };
}

export function detectPlatformInDocument(doc: Document, url: string): PlatformDetectionResult {
  for (const adapter of ATS_ADAPTERS) {
    if (adapter.detectPage(doc, url)) {
      return {
        detected: true,
        platform: adapter.id,
        label: adapter.displayName,
        url,
      };
    }
  }

  return { ...INITIAL_DETECTION_STATE };
}
