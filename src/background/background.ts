import { detectPlatformFromUrl } from '../adapters/registry';
import { DEFAULT_USER_PROFILE, INITIAL_DETECTION_STATE, STORAGE_KEYS } from '../shared/constants';
import type { ExtensionMessage, ExtensionMessageResponse } from '../shared/types';

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

async function resolveActiveTabPlatform(): Promise<ExtensionMessageResponse> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!activeTab?.id) {
    return { ok: true, detection: { ...INITIAL_DETECTION_STATE } };
  }

  try {
    const response = (await chrome.tabs.sendMessage(activeTab.id, {
      type: 'DETECT_PLATFORM',
    } satisfies ExtensionMessage)) as ExtensionMessageResponse | undefined;

    if (response?.ok) {
      return response;
    }
  } catch {
    // Content script is only injected on supported ATS origins.
  }

  if (activeTab.url) {
    return {
      ok: true,
      detection: detectPlatformFromUrl(activeTab.url),
    };
  }

  return { ok: true, detection: { ...INITIAL_DETECTION_STATE } };
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessageResponse) => void,
  ) => {
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
