import { INITIAL_DETECTION_STATE } from '../shared/constants';
import type {
  AutofillFieldResult,
  DetectedPageType,
  ExtensionMessage,
  ExtensionMessageResponse,
  PlatformDetectionResult,
} from '../shared/types';

let latestDetection: PlatformDetectionResult = INITIAL_DETECTION_STATE;

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

function isWorkdayApplicationEligible(detection: PlatformDetectionResult): boolean {
  return (
    detection.platformId === 'workday' &&
    detection.isSupported &&
    detection.isApplicationPage
  );
}

function updateAutofillButtonState(detection: PlatformDetectionResult, isBusy = false): void {
  const autofillBtn = document.getElementById('autofill-btn') as HTMLButtonElement | null;
  const noteEl = document.getElementById('autofill-note');
  if (!autofillBtn) {
    return;
  }

  const eligible = isWorkdayApplicationEligible(detection);
  autofillBtn.disabled = isBusy || !eligible;
  autofillBtn.textContent = isBusy ? 'Filling First Name...' : 'Auto-fill';

  if (noteEl) {
    if (eligible) {
      noteEl.textContent = 'Ready to fill First Name from your saved profile.';
    } else if (detection.platformId === 'workday' && detection.isSupported) {
      noteEl.textContent = 'Open a Workday application form to enable First Name auto-fill.';
    } else if (detection.platformId === 'greenhouse' && detection.isSupported) {
      noteEl.textContent = 'Greenhouse auto-fill will be enabled in a future milestone.';
    } else {
      noteEl.textContent = 'Auto-fill is enabled on Workday application pages (First Name only).';
    }
  }
}

function renderAutofillFeedback(result: AutofillFieldResult | null): void {
  const feedbackEl = document.getElementById('autofill-feedback');
  if (!feedbackEl) {
    return;
  }

  if (!result) {
    feedbackEl.hidden = true;
    feedbackEl.textContent = '';
    feedbackEl.className = 'autofill-feedback';
    return;
  }

  feedbackEl.hidden = false;
  feedbackEl.textContent = result.message;

  if (result.ok && result.status === 'filled') {
    feedbackEl.className = 'autofill-feedback autofill-feedback--success';
  } else if (
    result.status === 'already_populated' ||
    result.status === 'missing_profile' ||
    result.status === 'missing_first_name' ||
    result.status === 'field_not_found' ||
    result.status === 'field_ambiguous'
  ) {
    feedbackEl.className = 'autofill-feedback autofill-feedback--warning';
  } else {
    feedbackEl.className = 'autofill-feedback autofill-feedback--error';
  }
}

function renderDetectionState(detection: PlatformDetectionResult): void {
  latestDetection = detection;

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

  updateAutofillButtonState(detection);
}

async function queryPlatformStatus(): Promise<void> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'GET_PLATFORM_STATUS',
    } satisfies ExtensionMessage)) as ExtensionMessageResponse | undefined;

    if (response?.ok && 'detection' in response) {
      renderDetectionState(response.detection);
      return;
    }
  } catch {
    // Keep safe unsupported fallback state when messaging fails.
  }

  renderDetectionState(INITIAL_DETECTION_STATE);
}

async function handleAutofillClick(): Promise<void> {
  if (!isWorkdayApplicationEligible(latestDetection)) {
    return;
  }

  renderAutofillFeedback(null);
  updateAutofillButtonState(latestDetection, true);

  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'AUTOFILL_WORKDAY_FIRST_NAME',
    } satisfies ExtensionMessage)) as ExtensionMessageResponse | undefined;

    if (response?.ok && 'result' in response) {
      renderAutofillFeedback(response.result);
    } else {
      renderAutofillFeedback({
        ok: false,
        status: 'failed',
        field: 'firstName',
        message: 'Autofill failed.',
      });
    }
  } catch {
    renderAutofillFeedback({
      ok: false,
      status: 'failed',
      field: 'firstName',
      message: 'Autofill failed.',
    });
  } finally {
    updateAutofillButtonState(latestDetection, false);
  }
}

function initPopup(): void {
  renderDetectionState(INITIAL_DETECTION_STATE);
  renderAutofillFeedback(null);

  const autofillButton = document.getElementById('autofill-btn');
  autofillButton?.addEventListener('click', () => {
    void handleAutofillClick();
  });

  const settingsButton = document.getElementById('settings-btn');
  settingsButton?.addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
  });

  void queryPlatformStatus();
}

document.addEventListener('DOMContentLoaded', initPopup);
