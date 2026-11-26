import type { PlatformId } from '../shared/types';

/**
 * Contract for independent ATS platform adapters.
 * Milestone 1 covers platform recognition only; field extraction and
 * form population will be added in a later milestone.
 */
export interface ATSAdapter {
  readonly id: PlatformId;
  readonly displayName: string;
  matchesUrl(url: string): boolean;
  detectPage(doc: Document, url: string): boolean;
}
