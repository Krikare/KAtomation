import { INITIAL_DETECTION_STATE } from '../shared/constants';
import type {
  ExtensionMessage,
  ExtensionMessageResponse,
  PlatformDetectionResult,
} from '../shared/types';

function renderDetectionState(detection: PlatformDetectionResult): void {
  const nameEl = document.getElementById('platform-name');
  const dotEl = document.getElementById('platform-dot');
  const badgeEl = document.getElementById('platform-badge');
  const hintEl = document.getElementById('platform-hint');

  if (!nameEl || !dotEl || !badgeEl || !hintEl) {
    return;
  }

  if (detection.detected) {
    nameEl.textContent = detection.label;
    dotEl.className = 'status-dot status-dot--detected';
    badgeEl.textContent = 'Detected';
    badgeEl.className = 'status-badge status-badge--detected';
    hintEl.textContent = `Supported ATS platform recognized (${detection.label}).`;
  } else {
    nameEl.textContent = INITIAL_DETECTION_STATE.label;
    dotEl.className = 'status-dot status-dot--idle';
    badgeEl.textContent = 'Standby';
    badgeEl.className = 'status-badge status-badge--idle';
    hintEl.textContent = 'Supports Workday and Greenhouse application pages.';
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
    // Keep default "Not detected" state when messaging fails.
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
