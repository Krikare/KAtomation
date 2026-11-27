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
    platformId: "unknown",
    platformName: "Unknown",
    isSupported: false,
    isApplicationPage: false,
    pageType: "unsupported",
    reason: "Unsupported website or no active recruitment page detected.",
    url: ""
  };

  // src/popup/popup.ts
  function formatPageLabel(pageType, isApplicationPage) {
    if (isApplicationPage || pageType === "application") {
      return "Job Application";
    }
    if (pageType === "job_board") {
      return "Job Board / Careers";
    }
    if (pageType === "portal") {
      return "Platform Portal";
    }
    return "Not identified";
  }
  function renderDetectionState(detection) {
    const nameEl = document.getElementById("platform-name");
    const pageEl = document.getElementById("page-type");
    const supportEl = document.getElementById("support-status");
    const dotEl = document.getElementById("platform-dot");
    const badgeEl = document.getElementById("status-badge");
    const reasonEl = document.getElementById("detection-reason");
    if (!nameEl || !pageEl || !supportEl || !dotEl || !badgeEl || !reasonEl) {
      return;
    }
    const pageLabel = formatPageLabel(detection.pageType, detection.isApplicationPage);
    const supportLabel = detection.isSupported ? "Supported" : "Unsupported website";
    nameEl.textContent = detection.platformName;
    pageEl.textContent = pageLabel;
    supportEl.textContent = supportLabel;
    reasonEl.textContent = detection.reason;
    if (detection.isSupported && detection.isApplicationPage) {
      dotEl.className = "status-dot status-dot--application";
      badgeEl.textContent = "Job Application";
      badgeEl.className = "status-badge status-badge--application";
    } else if (detection.isSupported) {
      dotEl.className = "status-dot status-dot--supported";
      badgeEl.textContent = "Supported";
      badgeEl.className = "status-badge status-badge--supported";
    } else {
      dotEl.className = "status-dot status-dot--unsupported";
      badgeEl.textContent = "Unsupported";
      badgeEl.className = "status-badge status-badge--unsupported";
    }
  }
  async function queryPlatformStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_PLATFORM_STATUS"
      });
      if (response?.ok) {
        renderDetectionState(response.detection);
        return;
      }
    } catch {
    }
    renderDetectionState(INITIAL_DETECTION_STATE);
  }
  function initPopup() {
    renderDetectionState(INITIAL_DETECTION_STATE);
    const settingsButton = document.getElementById("settings-btn");
    settingsButton?.addEventListener("click", () => {
      void chrome.runtime.openOptionsPage();
    });
    void queryPlatformStatus();
  }
  document.addEventListener("DOMContentLoaded", initPopup);
})();
