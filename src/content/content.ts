import { detectPlatformInDocument } from '../adapters/registry';
import type { ExtensionMessage, ExtensionMessageResponse } from '../shared/types';

/**
 * Content script entrypoint for Milestone 1.
 * Only performs passive platform detection when queried; no DOM mutation or
 * form filling is performed in this milestone.
 */
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessageResponse) => void,
  ) => {
    if (message.type === 'DETECT_PLATFORM') {
      const detection = detectPlatformInDocument(document, window.location.href);
      sendResponse({ ok: true, detection });
      return false;
    }

    return false;
  },
);
