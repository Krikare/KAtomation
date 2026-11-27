import type { PlatformDetectionResult, PlatformId } from '../shared/types';

/**
 * Contract for independent ATS platform adapters.
 * Milestone 3 handles platform recognition, supported domain validation,
 * and application-page detection without modifying or filling page forms.
 */
export interface ATSAdapter {
  readonly id: PlatformId;
  readonly displayName: string;
  isSupportedUrl(url: string): boolean;
  detectFromUrl(url: string): PlatformDetectionResult;
  detectFromDocument(doc: Document, url: string): PlatformDetectionResult;
  getPageSignals(doc: Document | null, url: string): string[];
}
