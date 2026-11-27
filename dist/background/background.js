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
    platformId: "unknown",
    platformName: "Unknown",
    isSupported: false,
    isApplicationPage: false,
    pageType: "unsupported",
    reason: "Unsupported website or no active recruitment page detected.",
    url: ""
  };

  // src/adapters/greenhouseAdapter.ts
  var GREENHOUSE_BOARD_HOST_PATTERN = /^(?:boards|job-boards)(?:\.[a-z]{2})?\.greenhouse\.io$/i;
  var GREENHOUSE_ACTION_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*greenhouse\.io$/i;
  var GREENHOUSE_APPLY_PATH_PATTERN = /(?:^|\/)apply(?:\/|$)/i;
  var GREENHOUSE_APPLY_HASH_PATTERN = /^#(?:app|application|application_form)$/i;
  var GREENHOUSE_JOB_PATH_PATTERN = /^\/[^/]+\/jobs\/[^/]+/i;
  var GREENHOUSE_APPLICATION_SELECTORS = [
    "form#application_form",
    'input[name="job_application[first_name]"]',
    'input[name^="job_application["]'
  ];
  function parseHttpUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
  function hasEmbeddedGreenhouseForm(doc) {
    const form = doc.querySelector("form#application_form, form[action]");
    if (form) {
      const action = form.getAttribute("action");
      if (action) {
        const parsedAction = parseHttpUrl(action);
        if (parsedAction && GREENHOUSE_ACTION_HOST_PATTERN.test(parsedAction.hostname)) {
          return true;
        }
      }
    }
    const iframe = doc.querySelector("iframe[src]");
    if (iframe) {
      const src = iframe.getAttribute("src");
      if (src) {
        const parsedSrc = parseHttpUrl(src);
        if (parsedSrc && GREENHOUSE_BOARD_HOST_PATTERN.test(parsedSrc.hostname)) {
          return true;
        }
      }
    }
    return false;
  }
  var GreenhouseAdapter = class {
    id = "greenhouse";
    displayName = "Greenhouse";
    isSupportedUrl(url) {
      const parsed = parseHttpUrl(url);
      if (!parsed) {
        return false;
      }
      return GREENHOUSE_BOARD_HOST_PATTERN.test(parsed.hostname);
    }
    getPageSignals(doc, url) {
      const signals = [];
      const parsed = parseHttpUrl(url);
      if (parsed && GREENHOUSE_BOARD_HOST_PATTERN.test(parsed.hostname)) {
        signals.push(`hostname:${parsed.hostname}`);
        if (GREENHOUSE_APPLY_PATH_PATTERN.test(parsed.pathname) || GREENHOUSE_APPLY_HASH_PATTERN.test(parsed.hash)) {
          signals.push("path:application-route");
        } else if (GREENHOUSE_JOB_PATH_PATTERN.test(parsed.pathname)) {
          signals.push("path:job-posting");
        } else {
          signals.push("path:job-board");
        }
      }
      if (doc) {
        for (const selector of GREENHOUSE_APPLICATION_SELECTORS) {
          if (doc.querySelector(selector)) {
            signals.push(`dom:${selector}`);
            break;
          }
        }
        if (hasEmbeddedGreenhouseForm(doc)) {
          signals.push("dom:embedded-greenhouse-form");
        }
      }
      return signals;
    }
    detectFromUrl(url) {
      return this.evaluate(null, url);
    }
    detectFromDocument(doc, url) {
      return this.evaluate(doc, url);
    }
    evaluate(doc, url) {
      const parsed = parseHttpUrl(url);
      if (!parsed) {
        return this.unsupportedResult(url, "URL is missing or malformed.");
      }
      const isSupportedHost = GREENHOUSE_BOARD_HOST_PATTERN.test(parsed.hostname);
      const signals = this.getPageSignals(doc, url);
      const hasDomApplicationForm = Boolean(
        doc && (GREENHOUSE_APPLICATION_SELECTORS.some((selector) => doc.querySelector(selector)) || hasEmbeddedGreenhouseForm(doc))
      );
      if (!isSupportedHost) {
        if (hasDomApplicationForm) {
          return {
            platformId: this.id,
            platformName: this.displayName,
            isSupported: true,
            isApplicationPage: true,
            pageType: "application",
            reason: "Embedded Greenhouse application form detected on this page.",
            url,
            signals
          };
        }
        return this.unsupportedResult(url, "URL does not match a supported Greenhouse domain.");
      }
      const hasUrlApplySignal = GREENHOUSE_APPLY_PATH_PATTERN.test(parsed.pathname) || GREENHOUSE_APPLY_HASH_PATTERN.test(parsed.hash);
      if (hasUrlApplySignal || hasDomApplicationForm) {
        return {
          platformId: this.id,
          platformName: this.displayName,
          isSupported: true,
          isApplicationPage: true,
          pageType: "application",
          reason: hasDomApplicationForm ? "Greenhouse domain and application form elements detected." : "Greenhouse application route (/apply) detected.",
          url,
          signals
        };
      }
      const isJobPosting = GREENHOUSE_JOB_PATH_PATTERN.test(parsed.pathname);
      return {
        platformId: this.id,
        platformName: this.displayName,
        isSupported: true,
        isApplicationPage: false,
        pageType: "job_board",
        reason: isJobPosting ? "Greenhouse job posting detected, but no active application form was found." : "Greenhouse job board detected. Open a job posting or application form.",
        url,
        signals
      };
    }
    unsupportedResult(url, reason) {
      return {
        platformId: "unknown",
        platformName: "Unknown",
        isSupported: false,
        isApplicationPage: false,
        pageType: "unsupported",
        reason,
        url,
        signals: []
      };
    }
  };

  // src/adapters/workdayAdapter.ts
  var WORKDAY_JOBS_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*myworkdayjobs\.com$/i;
  var WORKDAY_PORTAL_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*myworkday\.com$/i;
  var WORKDAY_RECRUITING_PATH_PATTERN = /\/(?:recruiting|jobs?|careers|candidate|wday\/cxs|d\/task)(?:\/|$)/i;
  var WORKDAY_APPLICATION_PATH_PATTERN = /(?:^|\/)apply(?:\/|$)/i;
  var WORKDAY_APPLICATION_HASH_PATTERN = /^#\/?(?:.*\/)?apply(?:\/|\?|$)/i;
  var WORKDAY_APPLICATION_SELECTORS = [
    '[data-automation-id="applyManually"]',
    '[data-automation-id="workdayApplication"]',
    '[data-automation-id="applyFlow"]',
    '[data-automation-id="contactInformationPage"]',
    '[data-automation-id="myExperiencePage"]',
    '[data-automation-id="applicationQuestionsPage"]',
    '[data-automation-id="voluntaryDisclosuresPage"]',
    '[data-automation-id="selfIdentificationPage"]',
    '[data-automation-id^="formField-"]'
  ];
  var WORKDAY_RECRUITING_SELECTORS = [
    '[data-automation-id="jobPostingPage"]',
    '[data-automation-id="jobRequisitionTitle"]',
    '[data-automation-id="adventureButton"]',
    '[data-automation-id="jobPostingDescription"]'
  ];
  function parseHttpUrl2(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
  var WorkdayAdapter = class {
    id = "workday";
    displayName = "Workday";
    isSupportedUrl(url) {
      const parsed = parseHttpUrl2(url);
      if (!parsed) {
        return false;
      }
      return WORKDAY_JOBS_HOST_PATTERN.test(parsed.hostname) || WORKDAY_PORTAL_HOST_PATTERN.test(parsed.hostname);
    }
    getPageSignals(doc, url) {
      const signals = [];
      const parsed = parseHttpUrl2(url);
      if (parsed) {
        if (WORKDAY_JOBS_HOST_PATTERN.test(parsed.hostname)) {
          signals.push(`hostname:${parsed.hostname} (myworkdayjobs.com)`);
        } else if (WORKDAY_PORTAL_HOST_PATTERN.test(parsed.hostname)) {
          signals.push(`hostname:${parsed.hostname} (myworkday.com)`);
        }
        if (WORKDAY_APPLICATION_PATH_PATTERN.test(parsed.pathname) || WORKDAY_APPLICATION_HASH_PATTERN.test(parsed.hash)) {
          signals.push("path:application-route");
        } else if (WORKDAY_RECRUITING_PATH_PATTERN.test(parsed.pathname)) {
          signals.push("path:recruitment-route");
        }
      }
      if (doc) {
        for (const selector of WORKDAY_APPLICATION_SELECTORS) {
          if (doc.querySelector(selector)) {
            signals.push(`dom:${selector}`);
            break;
          }
        }
        for (const selector of WORKDAY_RECRUITING_SELECTORS) {
          if (doc.querySelector(selector)) {
            signals.push(`dom:${selector}`);
            break;
          }
        }
      }
      return signals;
    }
    detectFromUrl(url) {
      return this.evaluate(null, url);
    }
    detectFromDocument(doc, url) {
      return this.evaluate(doc, url);
    }
    evaluate(doc, url) {
      const parsed = parseHttpUrl2(url);
      if (!parsed) {
        return this.unsupportedResult(url, "URL is missing or malformed.");
      }
      const isJobsHost = WORKDAY_JOBS_HOST_PATTERN.test(parsed.hostname);
      const isPortalHost = WORKDAY_PORTAL_HOST_PATTERN.test(parsed.hostname);
      const signals = this.getPageSignals(doc, url);
      const hasDomApplicationSignal = Boolean(
        doc && WORKDAY_APPLICATION_SELECTORS.some((selector) => doc.querySelector(selector))
      );
      const hasDomRecruitingSignal = Boolean(
        doc && WORKDAY_RECRUITING_SELECTORS.some((selector) => doc.querySelector(selector))
      );
      if (!isJobsHost && !isPortalHost) {
        if (hasDomApplicationSignal) {
          return {
            platformId: this.id,
            platformName: this.displayName,
            isSupported: true,
            isApplicationPage: true,
            pageType: "application",
            reason: "Workday application form elements were detected on this page.",
            url,
            signals
          };
        }
        return this.unsupportedResult(url, "URL does not match a supported Workday domain.");
      }
      const hasUrlApplicationSignal = WORKDAY_APPLICATION_PATH_PATTERN.test(parsed.pathname) || WORKDAY_APPLICATION_HASH_PATTERN.test(parsed.hash);
      const hasUrlRecruitingSignal = WORKDAY_RECRUITING_PATH_PATTERN.test(parsed.pathname);
      if (hasUrlApplicationSignal || hasDomApplicationSignal) {
        return {
          platformId: this.id,
          platformName: this.displayName,
          isSupported: true,
          isApplicationPage: true,
          pageType: "application",
          reason: hasDomApplicationSignal ? "Workday domain and application form controls detected." : "Workday recruitment domain and application route (/apply) detected.",
          url,
          signals
        };
      }
      if (isJobsHost || hasUrlRecruitingSignal || hasDomRecruitingSignal) {
        return {
          platformId: this.id,
          platformName: this.displayName,
          isSupported: true,
          isApplicationPage: false,
          pageType: "job_board",
          reason: "Workday careers or job listing page detected. Open an application form to detect form fields.",
          url,
          signals
        };
      }
      return {
        platformId: this.id,
        platformName: this.displayName,
        isSupported: true,
        isApplicationPage: false,
        pageType: "portal",
        reason: "Workday tenant portal domain detected, but no recruitment or application page signals were found.",
        url,
        signals
      };
    }
    unsupportedResult(url, reason) {
      return {
        platformId: "unknown",
        platformName: "Unknown",
        isSupported: false,
        isApplicationPage: false,
        pageType: "unsupported",
        reason,
        url,
        signals: []
      };
    }
  };

  // src/adapters/registry.ts
  var ATS_ADAPTERS = [
    new WorkdayAdapter(),
    new GreenhouseAdapter()
  ];
  function createUnsupportedDetectionResult(url, reason = INITIAL_DETECTION_STATE.reason) {
    return {
      platformId: "unknown",
      platformName: "Unknown",
      isSupported: false,
      isApplicationPage: false,
      pageType: "unsupported",
      reason,
      url,
      signals: []
    };
  }
  function detectPlatformFromUrl(url) {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return createUnsupportedDetectionResult("", "No page URL available for platform detection.");
    }
    for (const adapter of ATS_ADAPTERS) {
      const result = adapter.detectFromUrl(trimmedUrl);
      if (result.isSupported) {
        return result;
      }
    }
    return createUnsupportedDetectionResult(
      trimmedUrl,
      "This website is not a supported Workday or Greenhouse recruitment platform."
    );
  }

  // src/background/background.ts
  var RESTRICTED_URL_PREFIXES = [
    "chrome://",
    "chrome-extension://",
    "edge://",
    "about:",
    "view-source:",
    "devtools://",
    "https://chromewebstore.google.com",
    "https://chrome.google.com/webstore"
  ];
  var tabDetectionCache = /* @__PURE__ */ new Map();
  function isRestrictedUrl(url) {
    const lower = url.toLowerCase();
    return RESTRICTED_URL_PREFIXES.some((prefix) => lower.startsWith(prefix));
  }
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
  chrome.tabs.onRemoved.addListener((tabId) => {
    tabDetectionCache.delete(tabId);
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      tabDetectionCache.delete(tabId);
    }
  });
  async function resolveActiveTabPlatform() {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || activeTab.id === void 0) {
      return {
        ok: true,
        detection: createUnsupportedDetectionResult("", "No active browser tab found.")
      };
    }
    const tabUrl = activeTab.url ?? "";
    if (tabUrl && isRestrictedUrl(tabUrl)) {
      return {
        ok: true,
        detection: createUnsupportedDetectionResult(
          tabUrl,
          "Restricted browser page. ATS detection is not available on Chrome internal or Web Store pages."
        )
      };
    }
    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        type: "DETECT_PLATFORM"
      });
      if (response?.ok) {
        tabDetectionCache.set(activeTab.id, response.detection);
        return response;
      }
    } catch {
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
        "",
        "Page URL is unavailable for this tab. Navigate to a supported recruitment page."
      )
    };
  }
  chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      if (message.type === "PLATFORM_DETECTION_REPORT") {
        if (sender.tab?.id !== void 0) {
          tabDetectionCache.set(sender.tab.id, message.detection);
        }
        sendResponse({ ok: true, detection: message.detection });
        return false;
      }
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
