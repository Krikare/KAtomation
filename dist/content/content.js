"use strict";
(() => {
  // src/shared/constants.ts
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
  function detectPlatformInDocument(doc, url) {
    for (const adapter of ATS_ADAPTERS) {
      if (adapter.detectPage(doc, url)) {
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

  // src/content/content.ts
  chrome.runtime.onMessage.addListener(
    (message, _sender, sendResponse) => {
      if (message.type === "DETECT_PLATFORM") {
        const detection = detectPlatformInDocument(document, window.location.href);
        sendResponse({ ok: true, detection });
        return false;
      }
      return false;
    }
  );
})();
