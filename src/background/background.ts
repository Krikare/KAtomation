import {
  createUnsupportedDetectionResult,
  detectPlatformFromUrl,
} from '../adapters/registry';
import { DEFAULT_USER_PROFILE, STORAGE_KEYS } from '../shared/constants';
import type {
  ExtensionMessage,
  ExtensionMessageResponse,
  PlatformDetectionResult,
} from '../shared/types';

const RESTRICTED_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'view-source:',
  'devtools://',
  'https://chromewebstore.google.com',
  'https://chrome.google.com/webstore',
] as const;

const tabDetectionCache = new Map<number, PlatformDetectionResult>();

function isRestrictedUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return RESTRICTED_URL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get([
    STORAGE_KEYS.USER_PROFILE,
    STORAGE_KEYS.APPLICATION_ANSWERS,
  ]);
  if (!existing[STORAGE_KEYS.USER_PROFILE]) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.USER_PROFILE]: { ...DEFAULT_USER_PROFILE },
    });
  }
  if (!existing[STORAGE_KEYS.APPLICATION_ANSWERS]) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.APPLICATION_ANSWERS]: [],
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabDetectionCache.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    tabDetectionCache.delete(tabId);
  }
});

async function resolveActiveTabPlatform(): Promise<ExtensionMessageResponse> {
  const lastFocusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const activeTab =
    lastFocusedTabs[0] ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  if (!activeTab || activeTab.id === undefined) {
    return {
      ok: true,
      detection: createUnsupportedDetectionResult('', 'No active browser tab found.'),
    };
  }

  const tabUrl = activeTab.url ?? '';

  if (tabUrl && isRestrictedUrl(tabUrl)) {
    return {
      ok: true,
      detection: createUnsupportedDetectionResult(
        tabUrl,
        'Restricted browser page. ATS detection is not available on Chrome internal or Web Store pages.',
      ),
    };
  }

  try {
    const response = (await chrome.tabs.sendMessage(activeTab.id, {
      type: 'DETECT_PLATFORM',
    } satisfies ExtensionMessage)) as ExtensionMessageResponse | undefined;

    if (response?.ok) {
      tabDetectionCache.set(activeTab.id, response.detection);
      return response;
    }
  } catch {
    // Content script is unavailable on unsupported origins or un-reloaded tabs.
  }

  const cached = tabDetectionCache.get(activeTab.id);
  if (cached && (!tabUrl || cached.url === tabUrl)) {
    return { ok: true, detection: cached };
  }

  if (tabUrl) {
    const urlDetection = detectPlatformFromUrl(tabUrl);
    tabDetectionCache.set(activeTab.id, urlDetection);
    return { ok: true, detection: urlDetection };
  }

  return {
    ok: true,
    detection: createUnsupportedDetectionResult(
      '',
      'Page URL is unavailable for this tab. Navigate to a supported recruitment page.',
    ),
  };
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessageResponse) => void,
  ) => {
    if (message.type === 'PLATFORM_DETECTION_REPORT') {
      if (sender.tab?.id !== undefined) {
        tabDetectionCache.set(sender.tab.id, message.detection);
      }
      sendResponse({ ok: true, detection: message.detection });
      return false;
    }

    if (message.type === 'GET_PLATFORM_STATUS') {
      void resolveActiveTabPlatform()
        .then(sendResponse)
        .catch((error: unknown) => {
          const messageText = error instanceof Error ? error.message : 'Unable to detect platform';
          sendResponse({ ok: false, error: messageText });
        });
      return true;
    }

    return false;
  },
);
