import { INITIAL_DETECTION_STATE } from '../shared/constants';
import type {
  DetectedPageType,
  ExtensionMessage,
  ExtensionMessageResponse,
  PlatformDetectionResult,
} from '../shared/types';

function formatPageLabel(pageType: DetectedPageType, isApplicationPage: boolean): string {
  if (isApplicationPage || pageType === 'application') {
    return 'Job Application';
  }
  if (pageType === 'job_board') {
    return 'Job Board / Careers';
  }
  if (pageType === 'portal') {
    return 'Platform Portal';
  }
  return 'Not identified';
}

function renderDetectionState(detection: PlatformDetectionResult): void {
  const nameEl = document.getElementById('platform-name');
  const pageEl = document.getElementById('page-type');
  const supportEl = document.getElementById('support-status');
  const dotEl = document.getElementById('platform-dot');
  const badgeEl = document.getElementById('status-badge');
  const reasonEl = document.getElementById('detection-reason');

  if (!nameEl || !pageEl || !supportEl || !dotEl || !badgeEl || !reasonEl) {
    return;
  }

  const pageLabel = formatPageLabel(detection.pageType, detection.isApplicationPage);
  const supportLabel = detection.isSupported ? 'Supported' : 'Unsupported website';

  nameEl.textContent = detection.platformName;
  pageEl.textContent = pageLabel;
  supportEl.textContent = supportLabel;
  reasonEl.textContent = detection.reason;

  if (detection.isSupported && detection.isApplicationPage) {
    dotEl.className = 'status-dot status-dot--application';
    badgeEl.textContent = 'Job Application';
    badgeEl.className = 'status-badge status-badge--application';
  } else if (detection.isSupported) {
    dotEl.className = 'status-dot status-dot--supported';
    badgeEl.textContent = 'Supported';
    badgeEl.className = 'status-badge status-badge--supported';
  } else {
    dotEl.className = 'status-dot status-dot--unsupported';
    badgeEl.textContent = 'Unsupported';
    badgeEl.className = 'status-badge status-badge--unsupported';
  }
}

async function queryPlatformStatus(): Promise<void> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'GET_PLATFORM_STATUS',
    } satisfies ExtensionMessage)) as ExtensionMessageResponse | undefined;

    if (response?.ok) {
      renderDetectionState(response.detection);
      return;
    }
  } catch {
    // Keep safe unsupported fallback state when messaging fails.
  }

  renderDetectionState(INITIAL_DETECTION_STATE);
}

function initPopup(): void {
  renderDetectionState(INITIAL_DETECTION_STATE);

  const settingsButton = document.getElementById('settings-btn');
  settingsButton?.addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
  });

  void queryPlatformStatus();
}

document.addEventListener('DOMContentLoaded', initPopup);
