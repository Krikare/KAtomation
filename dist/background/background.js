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
  var EMPLOYMENT_TYPE_LABELS = {
    full_time: "Full-time",
    part_time: "Part-time",
    internship: "Internship",
    contract: "Contract",
    freelance: "Freelance",
    other: "Other"
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
  var GREENHOUSE_BOARD_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*(?:boards|job-boards|my)(?:\.[a-z0-9-]+)*\.greenhouse\.io$/i;
  var GREENHOUSE_PORTAL_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*my(?:\.[a-z0-9-]+)*\.greenhouse\.io$/i;
  var GREENHOUSE_ACTION_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*greenhouse\.io$/i;
  var GREENHOUSE_APPLY_PATH_PATTERN = /(?:^|\/)(?:apply|application)(?:\/|$)/i;
  var GREENHOUSE_APPLY_HASH_PATTERN = /^#(?:app|application|application_form|application-form)$/i;
  var GREENHOUSE_JOB_PATH_PATTERN = /^\/(?:[^/]+\/jobs\/[^/]+|jobs\/[^/]+|view_job|embed\/job_app)/i;
  var GREENHOUSE_APPLICATION_SELECTORS = [
    "form#application_form",
    "form#application-form",
    'input[name="job_application[first_name]"]',
    'input[name^="job_application["]',
    "#application-form input#first_name",
    "#application-form input#email",
    "#application_form input#first_name",
    "form.application--form input#email"
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
    if (typeof doc.querySelectorAll === "function") {
      const forms = doc.querySelectorAll("form[action]");
      for (const form of Array.from(forms)) {
        const action = form.getAttribute("action");
        if (action) {
          const parsedAction = parseHttpUrl(action);
          if (parsedAction && GREENHOUSE_ACTION_HOST_PATTERN.test(parsedAction.hostname)) {
            return true;
          }
        }
      }
      const iframes = doc.querySelectorAll("iframe[src]");
      for (const iframe of Array.from(iframes)) {
        const src = iframe.getAttribute("src");
        if (src) {
          const parsedSrc = parseHttpUrl(src);
          if (parsedSrc && GREENHOUSE_BOARD_HOST_PATTERN.test(parsedSrc.hostname)) {
            return true;
          }
        }
      }
    } else {
      const form = doc.querySelector("form#application_form, form[action]");
      const action = form?.getAttribute("action");
      if (action) {
        const parsedAction = parseHttpUrl(action);
        if (parsedAction && GREENHOUSE_ACTION_HOST_PATTERN.test(parsedAction.hostname)) {
          return true;
        }
      }
      const iframe = doc.querySelector("iframe[src]");
      const src = iframe?.getAttribute("src");
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
        } else if (GREENHOUSE_PORTAL_HOST_PATTERN.test(parsed.hostname)) {
          signals.push("path:candidate-portal");
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
      const isPortalHost = GREENHOUSE_PORTAL_HOST_PATTERN.test(parsed.hostname);
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
      if (isPortalHost && !isJobPosting) {
        return {
          platformId: this.id,
          platformName: this.displayName,
          isSupported: true,
          isApplicationPage: false,
          pageType: "portal",
          reason: "Greenhouse candidate portal detected, but no active job posting or application form was found.",
          url,
          signals
        };
      }
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
    autofillFirstName(doc, url, firstName) {
      return autofillWorkdayFirstName(doc, url, firstName, this);
    }
  };
  var DISALLOWED_INPUT_TYPES = /* @__PURE__ */ new Set([
    "hidden",
    "checkbox",
    "radio",
    "file",
    "submit",
    "button",
    "reset",
    "image"
  ]);
  var DISALLOWED_AUTOCOMPLETE_VALUES = /* @__PURE__ */ new Set([
    "family-name",
    "additional-name",
    "name",
    "email",
    "tel",
    "organization",
    "street-address",
    "postal-code",
    "username",
    "new-password",
    "current-password"
  ]);
  var NEGATIVE_FIELD_PATTERN = /\b(?:last|middle|family|surname|full\s*name|fullname|preferred|emergency|reference|referral|manager|supervisor|email|phone|mobile|address|street|city|state|postal|zip|country)\b|(?:last|middle|family|surname|preferred)name/i;
  var EXACT_FIRST_NAME_LABEL_PATTERN = /^(?:legal\s+)?(?:first|given)\s*name$/i;
  var TIER1_FIRST_NAME_SELECTORS = [
    'input[data-automation-id="legalNameSection_firstName"]',
    '[data-automation-id="legalNameSection_firstName"] input',
    '[data-automation-id="formField-legalNameSection_firstName"] input',
    'input[name="legalName--firstName"]',
    'input[id="legalName--firstName"]',
    'input[id="name--legalName--firstName"]'
  ];
  var TIER2_FIRST_NAME_SELECTORS = [
    'input[data-automation-id="firstName"]',
    '[data-automation-id="formField-firstName"] input',
    'input[autocomplete="given-name"]',
    'input[name="firstName"]',
    'input[id="firstName"]',
    'input[name="first_name"]',
    'input[id="first_name"]',
    'input[name="first-name"]',
    'input[id="first-name"]'
  ];
  function escapeSelectorAttr(value) {
    return value.replace(/["\\]/g, "\\$&");
  }
  function normalizeLabelText(raw) {
    return raw.replace(/\*/g, " ").replace(/\(required\)|\brequired\b/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
  }
  function queryElements(root, selector) {
    if (typeof root.querySelectorAll === "function") {
      return Array.from(root.querySelectorAll(selector));
    }
    const single = root.querySelector(selector);
    return single ? [single] : [];
  }
  function getAccessibleLabel(doc, input) {
    const ariaLabel = input.getAttribute?.("aria-label");
    if (ariaLabel && ariaLabel.trim()) {
      return ariaLabel.trim();
    }
    const labelledBy = input.getAttribute?.("aria-labelledby");
    if (labelledBy && labelledBy.trim()) {
      const parts = labelledBy.trim().split(/\s+/).map((id) => doc.querySelector(`#${escapeSelectorAttr(id)}`)?.textContent?.trim() ?? "").filter((text) => text.length > 0);
      if (parts.length > 0) {
        return parts.join(" ");
      }
    }
    if (input.id) {
      const explicitLabel = doc.querySelector(`label[for="${escapeSelectorAttr(input.id)}"]`);
      if (explicitLabel?.textContent?.trim()) {
        return explicitLabel.textContent.trim();
      }
    }
    const wrappingLabel = typeof input.closest === "function" ? input.closest("label") : null;
    if (wrappingLabel?.textContent?.trim()) {
      return wrappingLabel.textContent.trim();
    }
    const fieldWrapper = typeof input.closest === "function" ? input.closest('[data-automation-id^="formField-"]') : null;
    if (fieldWrapper && typeof fieldWrapper.querySelectorAll === "function") {
      const nestedInputs = fieldWrapper.querySelectorAll("input");
      if (nestedInputs.length === 1) {
        const formLabel = fieldWrapper.querySelector('[data-automation-id="formLabel"]') ?? fieldWrapper.querySelector("label");
        if (formLabel?.textContent?.trim()) {
          return formLabel.textContent.trim();
        }
      }
    }
    return "";
  }
  function isEligibleFirstNameInput(doc, candidate) {
    const input = candidate;
    if (input.tagName && input.tagName.toUpperCase() !== "INPUT") {
      return false;
    }
    const rawType = (input.getAttribute?.("type") ?? input.type ?? "text").toLowerCase();
    if (DISALLOWED_INPUT_TYPES.has(rawType)) {
      return false;
    }
    if (input.disabled || input.readOnly || input.hidden || input.getAttribute?.("aria-hidden") === "true") {
      return false;
    }
    const autocomplete = (input.getAttribute?.("autocomplete") ?? "").trim().toLowerCase();
    if (autocomplete && DISALLOWED_AUTOCOMPLETE_VALUES.has(autocomplete)) {
      return false;
    }
    const labelText = getAccessibleLabel(doc, input);
    const metadataToInspect = [
      input.id ?? "",
      input.name ?? "",
      input.getAttribute?.("data-automation-id") ?? "",
      input.getAttribute?.("aria-label") ?? "",
      labelText
    ].join(" ");
    if (NEGATIVE_FIELD_PATTERN.test(metadataToInspect)) {
      return false;
    }
    return true;
  }
  function collectTierMatches(doc, selectors) {
    const unique = /* @__PURE__ */ new Set();
    let matchedSelector = "";
    for (const selector of selectors) {
      for (const el of queryElements(doc, selector)) {
        if (isEligibleFirstNameInput(doc, el)) {
          if (!matchedSelector) {
            matchedSelector = selector;
          }
          unique.add(el);
        }
      }
    }
    return { elements: Array.from(unique), matchedSelector };
  }
  function findWorkdayFirstNameField(doc) {
    const tier1 = collectTierMatches(doc, TIER1_FIRST_NAME_SELECTORS);
    if (tier1.elements.length === 1 && tier1.elements[0]) {
      return { status: "found", element: tier1.elements[0], matchedBy: tier1.matchedSelector };
    }
    if (tier1.elements.length > 1) {
      return {
        status: "ambiguous",
        reason: "Multiple First Name fields detected; unable to determine a unique target."
      };
    }
    const tier2 = collectTierMatches(doc, TIER2_FIRST_NAME_SELECTORS);
    if (tier2.elements.length === 1 && tier2.elements[0]) {
      return { status: "found", element: tier2.elements[0], matchedBy: tier2.matchedSelector };
    }
    if (tier2.elements.length > 1) {
      return {
        status: "ambiguous",
        reason: "Multiple First Name fields detected; unable to determine a unique target."
      };
    }
    const labelMatches = /* @__PURE__ */ new Set();
    for (const el of queryElements(doc, "input")) {
      if (!isEligibleFirstNameInput(doc, el)) {
        continue;
      }
      const normalizedLabel = normalizeLabelText(getAccessibleLabel(doc, el));
      if (normalizedLabel && EXACT_FIRST_NAME_LABEL_PATTERN.test(normalizedLabel)) {
        labelMatches.add(el);
      }
    }
    const resolved = Array.from(labelMatches);
    if (resolved.length === 1 && resolved[0]) {
      return { status: "found", element: resolved[0], matchedBy: "label:first-name" };
    }
    if (resolved.length > 1) {
      return {
        status: "ambiguous",
        reason: "Multiple First Name fields detected; unable to determine a unique target."
      };
    }
    return {
      status: "not_found",
      reason: "First Name field could not be identified."
    };
  }
  function setInputValueAndDispatchEvents(input, value) {
    if (typeof input.focus === "function") {
      input.focus();
    }
    const prototypeSetter = typeof HTMLInputElement !== "undefined" && input instanceof HTMLInputElement ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set : void 0;
    if (prototypeSetter) {
      prototypeSetter.call(input, value);
    } else {
      input.value = value;
    }
    if (typeof input.dispatchEvent === "function" && typeof Event === "function") {
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  function autofillWorkdayFirstName(doc, url, firstName, adapter = new WorkdayAdapter()) {
    if (!adapter.isSupportedUrl(url)) {
      return {
        ok: false,
        status: "unsupported_page",
        field: "firstName",
        message: "Autofill is only supported on Workday application pages."
      };
    }
    const detection = adapter.detectFromDocument(doc, url);
    if (detection.platformId !== "workday" || !detection.isSupported || !detection.isApplicationPage) {
      return {
        ok: false,
        status: "unsupported_page",
        field: "firstName",
        message: "Autofill is only supported on Workday application pages."
      };
    }
    const trimmedFirstName = firstName.trim();
    if (!trimmedFirstName) {
      return {
        ok: false,
        status: "missing_first_name",
        field: "firstName",
        message: "First Name is missing from your profile."
      };
    }
    const lookup = findWorkdayFirstNameField(doc);
    if (lookup.status !== "found") {
      return {
        ok: false,
        status: lookup.status === "ambiguous" ? "field_ambiguous" : "field_not_found",
        field: "firstName",
        message: lookup.reason
      };
    }
    const currentValue = (lookup.element.value ?? "").trim();
    if (currentValue.length > 0) {
      return {
        ok: false,
        status: "already_populated",
        field: "firstName",
        message: "Field already contains a value.",
        matchedBy: lookup.matchedBy
      };
    }
    try {
      setInputValueAndDispatchEvents(lookup.element, trimmedFirstName);
      return {
        ok: true,
        status: "filled",
        field: "firstName",
        message: "First Name filled successfully.",
        matchedBy: lookup.matchedBy
      };
    } catch {
      return {
        ok: false,
        status: "failed",
        field: "firstName",
        message: "Autofill failed."
      };
    }
  }

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

  // src/storage/profileStorage.ts
  function asString(value) {
    return typeof value === "string" ? value : "";
  }
  function generateId(prefix) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
  function normalizePersonalInfo(rawPersonal, legacy) {
    const source = rawPersonal && typeof rawPersonal === "object" ? rawPersonal : {};
    return {
      firstName: asString(source.firstName ?? legacy.firstName),
      middleName: asString(source.middleName),
      lastName: asString(source.lastName ?? legacy.lastName),
      email: asString(source.email ?? legacy.email),
      phone: asString(source.phone ?? legacy.phone),
      address: asString(source.address),
      city: asString(source.city ?? legacy.location),
      state: asString(source.state),
      country: asString(source.country),
      postalCode: asString(source.postalCode)
    };
  }
  function normalizeLinks(rawLinks, legacy) {
    const source = rawLinks && typeof rawLinks === "object" ? rawLinks : {};
    return {
      linkedinUrl: asString(source.linkedinUrl ?? legacy.linkedinUrl),
      githubUrl: asString(source.githubUrl ?? legacy.githubUrl),
      portfolioUrl: asString(source.portfolioUrl ?? legacy.portfolioUrl)
    };
  }
  function normalizeEducationRecord(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const item = raw;
    return {
      id: asString(item.id) || generateId("edu"),
      institution: asString(item.institution),
      degree: asString(item.degree),
      specialization: asString(item.specialization),
      startYear: asString(item.startYear),
      graduationYear: asString(item.graduationYear),
      cgpa: asString(item.cgpa)
    };
  }
  function normalizeEmploymentType(value) {
    if (typeof value === "string" && value in EMPLOYMENT_TYPE_LABELS) {
      return value;
    }
    return "";
  }
  function normalizeEmploymentRecord(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const item = raw;
    const currentlyWorking = Boolean(item.currentlyWorking);
    return {
      id: asString(item.id) || generateId("emp"),
      company: asString(item.company),
      jobTitle: asString(item.jobTitle),
      employmentType: normalizeEmploymentType(item.employmentType),
      startDate: asString(item.startDate),
      endDate: currentlyWorking ? "" : asString(item.endDate),
      currentlyWorking,
      responsibilities: asString(item.responsibilities)
    };
  }
  function normalizeWorkAuthorization(value) {
    if (value === "yes" || value === "no" || value === "prefer_not_to_say") {
      return value;
    }
    return "";
  }
  function normalizeSponsorship(value) {
    if (value === "no" || value === "yes" || value === "prefer_not_to_say") {
      return value;
    }
    return "";
  }
  function normalizeUserProfile(raw) {
    if (!raw || typeof raw !== "object") {
      return {
        ...DEFAULT_USER_PROFILE,
        personal: { ...DEFAULT_PERSONAL_INFO },
        education: [],
        employment: [],
        links: { ...DEFAULT_PROFESSIONAL_LINKS }
      };
    }
    const record = raw;
    const legacy = record;
    const education = Array.isArray(record.education) ? record.education.map(normalizeEducationRecord).filter((item) => item !== null) : [];
    const employment = Array.isArray(record.employment) ? record.employment.map(normalizeEmploymentRecord).filter((item) => item !== null) : [];
    const normalized = {
      personal: normalizePersonalInfo(record.personal, legacy),
      education,
      employment,
      links: normalizeLinks(record.links, legacy),
      workAuthorized: normalizeWorkAuthorization(record.workAuthorized),
      sponsorshipRequired: normalizeSponsorship(record.sponsorshipRequired)
    };
    if (typeof record.updatedAt === "string" && record.updatedAt.length > 0) {
      normalized.updatedAt = record.updatedAt;
    }
    return normalized;
  }
  function formatStorageError(action, error) {
    const detail = error instanceof Error ? error.message : String(error);
    return new Error(`Storage error while ${action}: ${detail}`);
  }
  async function getSavedFirstName() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PROFILE);
      const raw = result[STORAGE_KEYS.USER_PROFILE];
      if (!raw || typeof raw !== "object") {
        return {
          ok: false,
          status: "missing_profile",
          message: "No saved profile found. Open Settings to add your First Name."
        };
      }
      const profile = normalizeUserProfile(raw);
      const firstName = profile.personal.firstName.trim();
      if (!firstName) {
        return {
          ok: false,
          status: "missing_first_name",
          message: "First Name is missing from your profile."
        };
      }
      return { ok: true, firstName };
    } catch (error) {
      return {
        ok: false,
        status: "storage_error",
        message: formatStorageError("loading First Name", error).message
      };
    }
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
  async function getActiveTab() {
    const lastFocusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return lastFocusedTabs[0] ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  }
  async function resolveActiveTabPlatform() {
    const activeTab = await getActiveTab();
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
      if (response?.ok && "detection" in response) {
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
  function autofillResultResponse(result) {
    return { ok: true, result };
  }
  async function handleWorkdayFirstNameAutofill() {
    const activeTab = await getActiveTab();
    if (!activeTab || activeTab.id === void 0) {
      return autofillResultResponse({
        ok: false,
        status: "failed",
        field: "firstName",
        message: "No active browser tab found."
      });
    }
    const platformStatus = await resolveActiveTabPlatform();
    if (!platformStatus.ok || !("detection" in platformStatus)) {
      return autofillResultResponse({
        ok: false,
        status: "failed",
        field: "firstName",
        message: "Unable to verify current page platform."
      });
    }
    const { detection } = platformStatus;
    if (detection.platformId !== "workday" || !detection.isSupported || !detection.isApplicationPage) {
      return autofillResultResponse({
        ok: false,
        status: "unsupported_page",
        field: "firstName",
        message: "Autofill is only supported on Workday application pages."
      });
    }
    const firstNameLookup = await getSavedFirstName();
    if (!firstNameLookup.ok) {
      return autofillResultResponse({
        ok: false,
        status: firstNameLookup.status,
        field: "firstName",
        message: firstNameLookup.message
      });
    }
    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        type: "EXECUTE_FIRST_NAME_AUTOFILL",
        firstName: firstNameLookup.firstName
      });
      if (response?.ok && "result" in response) {
        return response;
      }
      return autofillResultResponse({
        ok: false,
        status: "failed",
        field: "firstName",
        message: "Autofill failed."
      });
    } catch {
      return autofillResultResponse({
        ok: false,
        status: "failed",
        field: "firstName",
        message: "Autofill failed. Reload the Workday tab and try again."
      });
    }
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
      if (message.type === "AUTOFILL_WORKDAY_FIRST_NAME") {
        void handleWorkdayFirstNameAutofill().then(sendResponse).catch((error) => {
          const messageText = error instanceof Error ? error.message : "Autofill failed.";
          sendResponse(
            autofillResultResponse({
              ok: false,
              status: "failed",
              field: "firstName",
              message: messageText
            })
          );
        });
        return true;
      }
      return false;
    }
  );
})();
