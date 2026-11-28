import { INITIAL_DETECTION_STATE } from '../shared/constants';
import type {
  AutofillFieldKey,
  AutofillFieldResult,
  DetectedPageType,
  ExtensionMessage,
  ExtensionMessageResponse,
  PlatformDetectionResult,
} from '../shared/types';

let latestDetection: PlatformDetectionResult = INITIAL_DETECTION_STATE;

const FIELD_LABELS: Readonly<Record<AutofillFieldKey, string>> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email',
};

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
  autofillBtn.textContent = isBusy ? 'Filling Fields...' : 'Auto-fill';

  if (noteEl) {
    if (eligible) {
      noteEl.textContent = 'Ready to fill First Name, Last Name, and Email from your profile.';
    } else if (detection.platformId === 'workday' && detection.isSupported) {
      noteEl.textContent = 'Open a Workday application form to enable auto-fill.';
    } else if (detection.platformId === 'greenhouse' && detection.isSupported) {
      noteEl.textContent = 'Greenhouse auto-fill will be enabled in a future milestone.';
    } else {
      noteEl.textContent =
        'Auto-fill is enabled on Workday application pages (First Name, Last Name, Email).';
    }
  }
}

function formatResultStatusText(result: AutofillFieldResult): string {
  switch (result.status) {
    case 'filled':
      return 'Filled successfully.';
    case 'already_populated':
      return 'Already populated.';
    case 'missing_profile':
    case 'missing_first_name':
    case 'missing_value':
      return 'Missing from profile.';
    case 'field_not_found':
      return 'Field not found.';
    case 'field_ambiguous':
      return 'Field ambiguous.';
    case 'unsupported_page':
      return 'Unsupported page.';
    case 'storage_error':
      return 'Storage error.';
    default:
      return result.message || 'Autofill failed.';
  }
}

function getFeedbackToneClass(result: AutofillFieldResult): string {
  if (result.ok && result.status === 'filled') {
    return 'autofill-feedback--success';
  }
  if (
    result.status === 'already_populated' ||
    result.status === 'missing_profile' ||
    result.status === 'missing_first_name' ||
    result.status === 'missing_value' ||
    result.status === 'field_not_found' ||
    result.status === 'field_ambiguous'
  ) {
    return 'autofill-feedback--warning';
  }
  return 'autofill-feedback--error';
}

function renderAutofillFeedbackList(results: AutofillFieldResult[] | null): void {
  const feedbackEl = document.getElementById('autofill-feedback');
  if (!feedbackEl) {
    return;
  }

  feedbackEl.replaceChildren();

  if (!results || results.length === 0) {
    feedbackEl.hidden = true;
    return;
  }

  feedbackEl.hidden = false;

  for (const result of results) {
    const row = document.createElement('div');
    row.className = `autofill-feedback ${getFeedbackToneClass(result)}`;

    const labelEl = document.createElement('span');
    labelEl.className = 'autofill-feedback-label';
    labelEl.textContent = `${result.label ?? FIELD_LABELS[result.field]}:`;

    const statusEl = document.createElement('span');
    statusEl.className = 'autofill-feedback-status';
    statusEl.textContent = formatResultStatusText(result);

    row.append(labelEl, statusEl);
    feedbackEl.appendChild(row);
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

  renderAutofillFeedbackList(null);
  updateAutofillButtonState(latestDetection, true);

  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'AUTOFILL_WORKDAY_FIELDS',
    } satisfies ExtensionMessage)) as ExtensionMessageResponse | undefined;

    if (response?.ok && 'batch' in response) {
      renderAutofillFeedbackList(response.batch.results);
    } else {
      renderAutofillFeedbackList([
        { ok: false, status: 'failed', field: 'firstName', label: 'First Name', message: 'Autofill failed.' },
        { ok: false, status: 'failed', field: 'lastName', label: 'Last Name', message: 'Autofill failed.' },
        { ok: false, status: 'failed', field: 'email', label: 'Email', message: 'Autofill failed.' },
      ]);
    }
  } catch {
    renderAutofillFeedbackList([
      { ok: false, status: 'failed', field: 'firstName', label: 'First Name', message: 'Autofill failed.' },
      { ok: false, status: 'failed', field: 'lastName', label: 'Last Name', message: 'Autofill failed.' },
      { ok: false, status: 'failed', field: 'email', label: 'Email', message: 'Autofill failed.' },
    ]);
  } finally {
    updateAutofillButtonState(latestDetection, false);
  }
}

function initPopup(): void {
  renderDetectionState(INITIAL_DETECTION_STATE);
  renderAutofillFeedbackList(null);

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
