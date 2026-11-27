"use strict";
(() => {
  // src/shared/constants.ts
  var STORAGE_KEYS = {
    USER_PROFILE: "katomation_user_profile",
    APPLICATION_ANSWERS: "katomation_application_answers"
  };
  var DEFAULT_PERSONAL_INFO = {
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: ""
  };
  var DEFAULT_PROFESSIONAL_LINKS = {
    linkedinUrl: "",
    githubUrl: "",
    portfolioUrl: ""
  };
  var DEFAULT_USER_PROFILE = {
    personal: { ...DEFAULT_PERSONAL_INFO },
    education: [],
    employment: [],
    links: { ...DEFAULT_PROFESSIONAL_LINKS },
    workAuthorized: "",
    sponsorshipRequired: ""
  };
  var INITIAL_DETECTION_STATE = {
    detected: false,
    platform: "unknown",
    label: "Not detected"
  };

  // src/adapters/greenhouseAdapter.ts
  var GREENHOUSE_HOST_PATTERNS = [
    /(^|\.)greenhouse\.io$/i
  ];
  var GreenhouseAdapter = class {
    id = "greenhouse";
    displayName = "Greenhouse";
    matchesUrl(url) {
      try {
        const { hostname } = new URL(url);
        return GREENHOUSE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
      } catch {
        return false;
      }
    }
    detectPage(doc, url) {
      if (this.matchesUrl(url)) {
        return true;
      }
      return Boolean(doc.querySelector('#application_form, form[action*="greenhouse.io"]'));
    }
  };

  // src/adapters/workdayAdapter.ts
  var WORKDAY_HOST_PATTERNS = [
    /(^|\.)myworkdayjobs\.com$/i,
    /(^|\.)myworkday\.com$/i
  ];
  var WorkdayAdapter = class {
    id = "workday";
    displayName = "Workday";
    matchesUrl(url) {
      try {
        const { hostname } = new URL(url);
        return WORKDAY_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
      } catch {
        return false;
      }
    }
    detectPage(doc, url) {
      if (this.matchesUrl(url)) {
        return true;
      }
      return Boolean(doc.querySelector('[data-automation-id="applyManually"], [data-automation-id="workdayApplication"]'));
    }
  };

  // src/adapters/registry.ts
  var ATS_ADAPTERS = [
    new WorkdayAdapter(),
    new GreenhouseAdapter()
  ];
  function detectPlatformFromUrl(url) {
    for (const adapter of ATS_ADAPTERS) {
      if (adapter.matchesUrl(url)) {
        return {
          detected: true,
          platform: adapter.id,
          label: adapter.displayName,
          url
        };
      }
    }
    return { ...INITIAL_DETECTION_STATE };
  }

  // src/background/background.ts
  chrome.runtime.onInstalled.addListener(async () => {
    const existing = await chrome.storage.local.get([
      STORAGE_KEYS.USER_PROFILE,
      STORAGE_KEYS.APPLICATION_ANSWERS
    ]);
    if (!existing[STORAGE_KEYS.USER_PROFILE]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.USER_PROFILE]: { ...DEFAULT_USER_PROFILE }
      });
    }
    if (!existing[STORAGE_KEYS.APPLICATION_ANSWERS]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.APPLICATION_ANSWERS]: []
      });
    }
  });
  async function resolveActiveTabPlatform() {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      return { ok: true, detection: { ...INITIAL_DETECTION_STATE } };
    }
    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        type: "DETECT_PLATFORM"
      });
      if (response?.ok) {
        return response;
      }
    } catch {
    }
    if (activeTab.url) {
      return {
        ok: true,
        detection: detectPlatformFromUrl(activeTab.url)
      };
    }
    return { ok: true, detection: { ...INITIAL_DETECTION_STATE } };
  }
  chrome.runtime.onMessage.addListener(
    (message, _sender, sendResponse) => {
      if (message.type === "GET_PLATFORM_STATUS") {
        void resolveActiveTabPlatform().then(sendResponse).catch((error) => {
          const messageText = error instanceof Error ? error.message : "Unable to detect platform";
          sendResponse({ ok: false, error: messageText });
        });
        return true;
      }
      return false;
    }
  );
})();
