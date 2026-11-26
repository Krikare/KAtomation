"use strict";
(() => {
  // src/shared/constants.ts
  var STORAGE_KEYS = {
    USER_PROFILE: "katomation_user_profile"
  };
  var DEFAULT_USER_PROFILE = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    linkedinUrl: "",
    githubUrl: "",
    portfolioUrl: "",
    workAuthorized: "",
    sponsorshipRequired: ""
  };

  // src/storage/profileStorage.ts
  async function getUserProfile() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PROFILE);
    const stored = result[STORAGE_KEYS.USER_PROFILE];
    if (!stored || typeof stored !== "object") {
      return { ...DEFAULT_USER_PROFILE };
    }
    return {
      ...DEFAULT_USER_PROFILE,
      ...stored
    };
  }
  async function saveUserProfile(profile) {
    const nextProfile = {
      ...DEFAULT_USER_PROFILE,
      ...profile,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await chrome.storage.local.set({
      [STORAGE_KEYS.USER_PROFILE]: nextProfile
    });
    return nextProfile;
  }
  async function clearUserProfile() {
    await chrome.storage.local.remove(STORAGE_KEYS.USER_PROFILE);
  }

  // src/options/options.ts
  var TEXT_FIELD_KEYS = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "location",
    "linkedinUrl",
    "githubUrl",
    "portfolioUrl"
  ];
  function setStatusMessage(message, variant = "neutral") {
    const statusEl = document.getElementById("save-status");
    if (!statusEl) {
      return;
    }
    statusEl.textContent = message;
    statusEl.className = "save-status";
    if (variant === "success") {
      statusEl.classList.add("save-status--success");
    } else if (variant === "error") {
      statusEl.classList.add("save-status--error");
    }
  }
  function populateForm(profile) {
    for (const key of TEXT_FIELD_KEYS) {
      const input = document.getElementById(key);
      if (input) {
        input.value = profile[key];
      }
    }
    const workAuthEl = document.getElementById("workAuthorized");
    if (workAuthEl) {
      workAuthEl.value = profile.workAuthorized;
    }
    const sponsorshipEl = document.getElementById("sponsorshipRequired");
    if (sponsorshipEl) {
      sponsorshipEl.value = profile.sponsorshipRequired;
    }
  }
  function readFormValues() {
    const profile = { ...DEFAULT_USER_PROFILE };
    for (const key of TEXT_FIELD_KEYS) {
      const input = document.getElementById(key);
      profile[key] = input?.value.trim() ?? "";
    }
    const workAuthEl = document.getElementById("workAuthorized");
    profile.workAuthorized = workAuthEl?.value ?? "";
    const sponsorshipEl = document.getElementById("sponsorshipRequired");
    profile.sponsorshipRequired = sponsorshipEl?.value ?? "";
    return profile;
  }
  async function initOptionsPage() {
    const form = document.getElementById("profile-form");
    const clearBtn = document.getElementById("clear-btn");
    if (!form) {
      return;
    }
    try {
      const savedProfile = await getUserProfile();
      populateForm(savedProfile);
    } catch {
      setStatusMessage("Unable to load saved profile from local storage.", "error");
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatusMessage("");
      try {
        const nextProfile = readFormValues();
        await saveUserProfile(nextProfile);
        setStatusMessage("Profile saved locally.", "success");
      } catch {
        setStatusMessage("Failed to save profile.", "error");
      }
    });
    clearBtn?.addEventListener("click", async () => {
      setStatusMessage("");
      try {
        await clearUserProfile();
        populateForm(DEFAULT_USER_PROFILE);
        setStatusMessage("Saved profile data cleared.", "success");
      } catch {
        setStatusMessage("Failed to clear saved profile.", "error");
      }
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    void initOptionsPage();
  });
})();
