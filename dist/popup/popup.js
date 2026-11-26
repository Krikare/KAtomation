"use strict";
(() => {
  // src/shared/constants.ts
  var INITIAL_DETECTION_STATE = {
    detected: false,
    platform: "unknown",
    label: "Not detected"
  };

  // src/popup/popup.ts
  function renderDetectionState(detection) {
    const nameEl = document.getElementById("platform-name");
    const dotEl = document.getElementById("platform-dot");
    const badgeEl = document.getElementById("platform-badge");
    const hintEl = document.getElementById("platform-hint");
    if (!nameEl || !dotEl || !badgeEl || !hintEl) {
      return;
    }
    if (detection.detected) {
      nameEl.textContent = detection.label;
      dotEl.className = "status-dot status-dot--detected";
      badgeEl.textContent = "Detected";
      badgeEl.className = "status-badge status-badge--detected";
      hintEl.textContent = `Supported ATS platform recognized (${detection.label}).`;
    } else {
      nameEl.textContent = INITIAL_DETECTION_STATE.label;
      dotEl.className = "status-dot status-dot--idle";
      badgeEl.textContent = "Standby";
      badgeEl.className = "status-badge status-badge--idle";
      hintEl.textContent = "Supports Workday and Greenhouse application pages.";
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
