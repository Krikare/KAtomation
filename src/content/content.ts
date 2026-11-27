import { detectPlatformInDocument } from '../adapters/registry';
import type {
  ExtensionMessage,
  ExtensionMessageResponse,
  PlatformDetectionResult,
} from '../shared/types';

const SPA_DEBOUNCE_MS = 300;

let lastReportedSignature = '';
let debounceTimer: number | undefined;

function getDetectionSignature(result: PlatformDetectionResult): string {
  return [
    result.platformId,
    String(result.isSupported),
    String(result.isApplicationPage),
    result.pageType,
    result.url,
    result.reason,
  ].join('|');
}

function runDetection(): PlatformDetectionResult {
  return detectPlatformInDocument(document, window.location.href);
}

function reportDetectionIfChanged(): void {
  const detection = runDetection();
  const signature = getDetectionSignature(detection);

  if (signature === lastReportedSignature) {
    return;
  }

  lastReportedSignature = signature;

  try {
    void chrome.runtime
      .sendMessage({
        type: 'PLATFORM_DETECTION_REPORT',
        detection,
      } satisfies ExtensionMessage)
      .catch(() => {
        // Ignore transient service worker wakeup errors.
      });
  } catch {
    // Ignore when extension context is invalidated.
  }
}

function scheduleDetectionCheck(): void {
  if (debounceTimer !== undefined) {
    window.clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(() => {
    debounceTimer = undefined;
    reportDetectionIfChanged();
  }, SPA_DEBOUNCE_MS);
}

function initContentDetection(): void {
  reportDetectionIfChanged();

  window.addEventListener('popstate', scheduleDetectionCheck);
  window.addEventListener('hashchange', scheduleDetectionCheck);

  const root = document.documentElement ?? document.body;
  if (root) {
    const observer = new MutationObserver(() => {
      scheduleDetectionCheck();
    });
    observer.observe(root, { childList: true, subtree: true });
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessageResponse) => void,
  ) => {
    if (message.type === 'DETECT_PLATFORM') {
      const detection = runDetection();
      lastReportedSignature = getDetectionSignature(detection);
      sendResponse({ ok: true, detection });
      return false;
    }

    return false;
  },
);

initContentDetection();
