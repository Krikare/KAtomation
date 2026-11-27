import { INITIAL_DETECTION_STATE } from '../shared/constants';
import type { PlatformDetectionResult } from '../shared/types';
import type { ATSAdapter } from './baseAdapter';
import { GreenhouseAdapter } from './greenhouseAdapter';
import { WorkdayAdapter } from './workdayAdapter';

export const ATS_ADAPTERS: readonly ATSAdapter[] = [
  new WorkdayAdapter(),
  new GreenhouseAdapter(),
];

export function createUnsupportedDetectionResult(
  url: string,
  reason = INITIAL_DETECTION_STATE.reason,
): PlatformDetectionResult {
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

export function detectPlatformFromUrl(url: string): PlatformDetectionResult {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return createUnsupportedDetectionResult('', 'No page URL available for platform detection.');
  }

  for (const adapter of ATS_ADAPTERS) {
    const result = adapter.detectFromUrl(trimmedUrl);
    if (result.isSupported) {
      return result;
    }
  }

  return createUnsupportedDetectionResult(
    trimmedUrl,
    'This website is not a supported Workday or Greenhouse recruitment platform.',
  );
}

export function detectPlatformInDocument(doc: Document, url: string): PlatformDetectionResult {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return createUnsupportedDetectionResult('', 'No page URL available for platform detection.');
  }

  for (const adapter of ATS_ADAPTERS) {
    const result = adapter.detectFromDocument(doc, trimmedUrl);
    if (result.isSupported) {
      return result;
    }
  }

  return createUnsupportedDetectionResult(
    trimmedUrl,
    'This website is not a supported Workday or Greenhouse recruitment platform.',
  );
}
