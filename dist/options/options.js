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
  var ANSWER_CATEGORY_LABELS = {
    work_authorization: "Work authorization",
    sponsorship: "Visa sponsorship",
    education: "Education",
    employment: "Employment",
    relocation: "Relocation",
    notice_period: "Notice period",
    availability: "Availability",
    salary_expectations: "Salary expectations",
    general: "General questions",
    custom: "Custom questions"
  };

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
  function normalizeAnswerCategory(value) {
    if (typeof value === "string" && value in ANSWER_CATEGORY_LABELS) {
      return value;
    }
    return "custom";
  }
  function normalizeApplicationAnswer(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const item = raw;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const keywords = Array.isArray(item.keywords) ? item.keywords.filter((kw) => typeof kw === "string").map((kw) => kw.trim()).filter((kw) => kw.length > 0) : [];
    return {
      id: asString(item.id) || generateId("ans"),
      question: asString(item.question),
      answer: asString(item.answer),
      category: normalizeAnswerCategory(item.category),
      keywords,
      requiresConfirmation: Boolean(item.requiresConfirmation),
      createdAt: asString(item.createdAt) || now,
      updatedAt: asString(item.updatedAt) || now
    };
  }
  function formatStorageError(action, error) {
    const detail = error instanceof Error ? error.message : String(error);
    return new Error(`Storage error while ${action}: ${detail}`);
  }
  async function getUserProfile() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PROFILE);
      return normalizeUserProfile(result[STORAGE_KEYS.USER_PROFILE]);
    } catch (error) {
      throw formatStorageError("loading user profile", error);
    }
  }
  async function saveUserProfile(profile) {
    try {
      const existingResult = await chrome.storage.local.get(STORAGE_KEYS.USER_PROFILE);
      const existingProfile = normalizeUserProfile(existingResult[STORAGE_KEYS.USER_PROFILE]);
      const normalizedInput = normalizeUserProfile(profile);
      const nextProfile = {
        personal: { ...DEFAULT_PERSONAL_INFO, ...normalizedInput.personal },
        education: normalizedInput.education,
        employment: normalizedInput.employment,
        links: { ...DEFAULT_PROFESSIONAL_LINKS, ...normalizedInput.links },
        workAuthorized: normalizedInput.workAuthorized || existingProfile.workAuthorized,
        sponsorshipRequired: normalizedInput.sponsorshipRequired || existingProfile.sponsorshipRequired,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await chrome.storage.local.set({
        [STORAGE_KEYS.USER_PROFILE]: nextProfile
      });
      return nextProfile;
    } catch (error) {
      throw formatStorageError("saving user profile", error);
    }
  }
  async function clearUserProfile() {
    try {
      await chrome.storage.local.remove(STORAGE_KEYS.USER_PROFILE);
    } catch (error) {
      throw formatStorageError("clearing user profile", error);
    }
  }
  async function getApplicationAnswers() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.APPLICATION_ANSWERS);
      const raw = result[STORAGE_KEYS.APPLICATION_ANSWERS];
      if (!Array.isArray(raw)) {
        return [];
      }
      return raw.map(normalizeApplicationAnswer).filter((item) => item !== null);
    } catch (error) {
      throw formatStorageError("loading application answers", error);
    }
  }
  async function saveApplicationAnswers(answers) {
    try {
      const normalized = answers.map(normalizeApplicationAnswer).filter((item) => item !== null);
      await chrome.storage.local.set({
        [STORAGE_KEYS.APPLICATION_ANSWERS]: normalized
      });
      return normalized;
    } catch (error) {
      throw formatStorageError("saving application answers", error);
    }
  }

  // src/options/options.ts
  var PERSONAL_FIELD_KEYS = [
    "firstName",
    "middleName",
    "lastName",
    "email",
    "phone",
    "address",
    "city",
    "state",
    "country",
    "postalCode"
  ];
  var LINK_FIELD_KEYS = [
    "linkedinUrl",
    "githubUrl",
    "portfolioUrl"
  ];
  var educationEntries = [];
  var employmentEntries = [];
  var applicationAnswers = [];
  var editingAnswerId = null;
  var loadedProfileMeta = {
    workAuthorized: "",
    sponsorshipRequired: ""
  };
  function createLocalId(prefix) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
  function setStatus(elementId, message, variant = "neutral") {
    const statusEl = document.getElementById(elementId);
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
  function createField(labelText, control, fullWidth = false) {
    const wrapper = document.createElement("div");
    wrapper.className = fullWidth ? "field field--full" : "field";
    const label = document.createElement("label");
    if (control.id) {
      label.htmlFor = control.id;
    }
    label.textContent = labelText;
    wrapper.append(label, control);
    return wrapper;
  }
  function createTextInput(id, value, placeholder, onInput) {
    const input = document.createElement("input");
    input.id = id;
    input.type = "text";
    input.value = value;
    input.placeholder = placeholder;
    input.addEventListener("input", () => {
      onInput(input.value);
    });
    return input;
  }
  function createEmptyState(message) {
    const box = document.createElement("div");
    box.className = "empty-state";
    box.textContent = message;
    return box;
  }
  function renderEducationList() {
    const container = document.getElementById("education-list");
    if (!container) {
      return;
    }
    container.replaceChildren();
    if (educationEntries.length === 0) {
      container.appendChild(
        createEmptyState('No education records added yet. Click "+ Add Education" to add one.')
      );
      return;
    }
    educationEntries.forEach((entry, index) => {
      const card = document.createElement("div");
      card.className = "entry-card";
      const header = document.createElement("div");
      header.className = "entry-card-header";
      const title = document.createElement("h3");
      title.className = "entry-card-title";
      title.textContent = `Education #${index + 1}`;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-danger btn-sm";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        const hasData = Boolean(
          entry.institution.trim() || entry.degree.trim() || entry.specialization.trim() || entry.startYear.trim() || entry.graduationYear.trim() || entry.cgpa.trim()
        );
        if (hasData && !window.confirm(`Remove Education #${index + 1}?`)) {
          return;
        }
        educationEntries = educationEntries.filter((item) => item.id !== entry.id);
        renderEducationList();
      });
      header.append(title, removeBtn);
      const grid = document.createElement("div");
      grid.className = "field-grid";
      grid.append(
        createField(
          "Institution",
          createTextInput(`edu-inst-${entry.id}`, entry.institution, "State University", (val) => {
            entry.institution = val;
          }),
          true
        ),
        createField(
          "Degree",
          createTextInput(`edu-deg-${entry.id}`, entry.degree, "Bachelor of Science", (val) => {
            entry.degree = val;
          })
        ),
        createField(
          "Specialization / Major",
          createTextInput(
            `edu-spec-${entry.id}`,
            entry.specialization,
            "Computer Science",
            (val) => {
              entry.specialization = val;
            }
          )
        ),
        createField(
          "Start Year",
          createTextInput(`edu-start-${entry.id}`, entry.startYear, "2020", (val) => {
            entry.startYear = val;
          })
        ),
        createField(
          "Graduation Year",
          createTextInput(`edu-grad-${entry.id}`, entry.graduationYear, "2024", (val) => {
            entry.graduationYear = val;
          })
        ),
        createField(
          "CGPA / GPA",
          createTextInput(`edu-cgpa-${entry.id}`, entry.cgpa, "3.85 / 4.0", (val) => {
            entry.cgpa = val;
          })
        )
      );
      card.append(header, grid);
      container.appendChild(card);
    });
  }
  function renderEmploymentList() {
    const container = document.getElementById("employment-list");
    if (!container) {
      return;
    }
    container.replaceChildren();
    if (employmentEntries.length === 0) {
      container.appendChild(
        createEmptyState('No employment records added yet. Click "+ Add Employment" to add one.')
      );
      return;
    }
    employmentEntries.forEach((entry, index) => {
      const card = document.createElement("div");
      card.className = "entry-card";
      const header = document.createElement("div");
      header.className = "entry-card-header";
      const title = document.createElement("h3");
      title.className = "entry-card-title";
      title.textContent = `Employment #${index + 1}`;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-danger btn-sm";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        const hasData = Boolean(
          entry.company.trim() || entry.jobTitle.trim() || entry.employmentType || entry.startDate.trim() || entry.endDate.trim() || entry.currentlyWorking || entry.responsibilities.trim()
        );
        if (hasData && !window.confirm(`Remove Employment #${index + 1}?`)) {
          return;
        }
        employmentEntries = employmentEntries.filter((item) => item.id !== entry.id);
        renderEmploymentList();
      });
      header.append(title, removeBtn);
      const typeSelect = document.createElement("select");
      typeSelect.id = `emp-type-${entry.id}`;
      const placeholderOption = document.createElement("option");
      placeholderOption.value = "";
      placeholderOption.textContent = "Select employment type";
      typeSelect.appendChild(placeholderOption);
      for (const [value, label] of Object.entries(EMPLOYMENT_TYPE_LABELS)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        typeSelect.appendChild(option);
      }
      typeSelect.value = entry.employmentType;
      typeSelect.addEventListener("change", () => {
        entry.employmentType = typeSelect.value;
      });
      const endDateInput = createTextInput(
        `emp-end-${entry.id}`,
        entry.currentlyWorking ? "" : entry.endDate,
        entry.currentlyWorking ? "Present" : "2025-08",
        (val) => {
          entry.endDate = val;
        }
      );
      endDateInput.disabled = entry.currentlyWorking;
      const currentCheckbox = document.createElement("input");
      currentCheckbox.id = `emp-current-${entry.id}`;
      currentCheckbox.type = "checkbox";
      currentCheckbox.checked = entry.currentlyWorking;
      currentCheckbox.addEventListener("change", () => {
        entry.currentlyWorking = currentCheckbox.checked;
        endDateInput.disabled = entry.currentlyWorking;
        if (entry.currentlyWorking) {
          entry.endDate = "";
          endDateInput.value = "";
          endDateInput.placeholder = "Present";
        } else {
          endDateInput.placeholder = "2025-08";
        }
      });
      const currentLabel = document.createElement("label");
      currentLabel.className = "checkbox-row";
      currentLabel.htmlFor = currentCheckbox.id;
      const currentLabelText = document.createElement("span");
      currentLabelText.textContent = "Currently working here";
      currentLabel.append(currentCheckbox, currentLabelText);
      const currentFieldWrapper = document.createElement("div");
      currentFieldWrapper.className = "field field--full";
      currentFieldWrapper.appendChild(currentLabel);
      const responsibilitiesEl = document.createElement("textarea");
      responsibilitiesEl.id = `emp-resp-${entry.id}`;
      responsibilitiesEl.rows = 3;
      responsibilitiesEl.value = entry.responsibilities;
      responsibilitiesEl.placeholder = "Key achievements, systems built, or responsibilities...";
      responsibilitiesEl.addEventListener("input", () => {
        entry.responsibilities = responsibilitiesEl.value;
      });
      const grid = document.createElement("div");
      grid.className = "field-grid";
      grid.append(
        createField(
          "Company",
          createTextInput(`emp-comp-${entry.id}`, entry.company, "Acme Corp", (val) => {
            entry.company = val;
          })
        ),
        createField(
          "Job Title",
          createTextInput(`emp-title-${entry.id}`, entry.jobTitle, "Software Engineer", (val) => {
            entry.jobTitle = val;
          })
        ),
        createField("Employment Type", typeSelect),
        createField(
          "Start Date",
          createTextInput(`emp-start-${entry.id}`, entry.startDate, "2023-06", (val) => {
            entry.startDate = val;
          })
        ),
        createField("End Date", endDateInput),
        currentFieldWrapper,
        createField("Responsibilities", responsibilitiesEl, true)
      );
      card.append(header, grid);
      container.appendChild(card);
    });
  }
  function populateProfileForm(profile) {
    for (const key of PERSONAL_FIELD_KEYS) {
      const input = document.getElementById(key);
      if (input) {
        input.value = profile.personal[key];
      }
    }
    for (const key of LINK_FIELD_KEYS) {
      const input = document.getElementById(key);
      if (input) {
        input.value = profile.links[key];
      }
    }
    educationEntries = profile.education.map((item) => ({ ...item }));
    employmentEntries = profile.employment.map((item) => ({ ...item }));
    loadedProfileMeta = {
      workAuthorized: profile.workAuthorized,
      sponsorshipRequired: profile.sponsorshipRequired
    };
    renderEducationList();
    renderEmploymentList();
  }
  function readProfileForm() {
    const personal = { ...DEFAULT_PERSONAL_INFO };
    for (const key of PERSONAL_FIELD_KEYS) {
      const input = document.getElementById(key);
      personal[key] = input?.value.trim() ?? "";
    }
    const links = { ...DEFAULT_PROFESSIONAL_LINKS };
    for (const key of LINK_FIELD_KEYS) {
      const input = document.getElementById(key);
      links[key] = input?.value.trim() ?? "";
    }
    const education = educationEntries.map((item) => ({
      id: item.id,
      institution: item.institution.trim(),
      degree: item.degree.trim(),
      specialization: item.specialization.trim(),
      startYear: item.startYear.trim(),
      graduationYear: item.graduationYear.trim(),
      cgpa: item.cgpa.trim()
    }));
    const employment = employmentEntries.map((item) => ({
      id: item.id,
      company: item.company.trim(),
      jobTitle: item.jobTitle.trim(),
      employmentType: item.employmentType,
      startDate: item.startDate.trim(),
      endDate: item.currentlyWorking ? "" : item.endDate.trim(),
      currentlyWorking: item.currentlyWorking,
      responsibilities: item.responsibilities.trim()
    }));
    return {
      personal,
      education,
      employment,
      links,
      workAuthorized: loadedProfileMeta.workAuthorized,
      sponsorshipRequired: loadedProfileMeta.sponsorshipRequired
    };
  }
  function resetAnswerEditor() {
    editingAnswerId = null;
    const titleEl = document.getElementById("answer-form-title");
    const saveBtn = document.getElementById("save-answer-btn");
    const cancelBtn = document.getElementById("cancel-answer-btn");
    const questionEl = document.getElementById("answer-question");
    const categoryEl = document.getElementById("answer-category");
    const keywordsEl = document.getElementById("answer-keywords");
    const answerEl = document.getElementById("answer-text");
    const confirmEl = document.getElementById(
      "answer-requires-confirmation"
    );
    if (titleEl) titleEl.textContent = "Add Application Answer";
    if (saveBtn) saveBtn.textContent = "Save Answer";
    if (cancelBtn) cancelBtn.hidden = true;
    if (questionEl) questionEl.value = "";
    if (categoryEl) categoryEl.value = "general";
    if (keywordsEl) keywordsEl.value = "";
    if (answerEl) answerEl.value = "";
    if (confirmEl) confirmEl.checked = false;
  }
  function startEditingAnswer(answer) {
    editingAnswerId = answer.id;
    const titleEl = document.getElementById("answer-form-title");
    const saveBtn = document.getElementById("save-answer-btn");
    const cancelBtn = document.getElementById("cancel-answer-btn");
    const questionEl = document.getElementById("answer-question");
    const categoryEl = document.getElementById("answer-category");
    const keywordsEl = document.getElementById("answer-keywords");
    const answerEl = document.getElementById("answer-text");
    const confirmEl = document.getElementById(
      "answer-requires-confirmation"
    );
    if (titleEl) titleEl.textContent = "Edit Application Answer";
    if (saveBtn) saveBtn.textContent = "Update Answer";
    if (cancelBtn) cancelBtn.hidden = false;
    if (questionEl) questionEl.value = answer.question;
    if (categoryEl) categoryEl.value = answer.category;
    if (keywordsEl) keywordsEl.value = answer.keywords.join(", ");
    if (answerEl) answerEl.value = answer.answer;
    if (confirmEl) confirmEl.checked = answer.requiresConfirmation;
    setStatus("answer-status", "");
    questionEl?.focus();
  }
  function renderAnswersList() {
    const container = document.getElementById("answers-list");
    const countEl = document.getElementById("answers-count");
    const filterCategoryEl = document.getElementById("filter-category");
    const filterSearchEl = document.getElementById("filter-search");
    if (!container) {
      return;
    }
    const categoryFilter = filterCategoryEl?.value ?? "all";
    const searchTerm = (filterSearchEl?.value ?? "").trim().toLowerCase();
    const filtered = applicationAnswers.filter((entry) => {
      if (categoryFilter !== "all" && entry.category !== categoryFilter) {
        return false;
      }
      if (!searchTerm) {
        return true;
      }
      const haystack = [
        entry.question,
        entry.answer,
        ANSWER_CATEGORY_LABELS[entry.category],
        ...entry.keywords
      ].join(" ").toLowerCase();
      return haystack.includes(searchTerm);
    });
    if (countEl) {
      const total = applicationAnswers.length;
      const shown = filtered.length;
      countEl.textContent = shown === total ? `${total} saved ${total === 1 ? "answer" : "answers"}` : `Showing ${shown} of ${total} saved answers`;
    }
    container.replaceChildren();
    if (applicationAnswers.length === 0) {
      container.appendChild(
        createEmptyState("No saved application answers yet. Add your first answer above.")
      );
      return;
    }
    if (filtered.length === 0) {
      container.appendChild(
        createEmptyState("No saved answers match the current category or search filter.")
      );
      return;
    }
    for (const item of filtered) {
      const card = document.createElement("article");
      card.className = "answer-card";
      const topRow = document.createElement("div");
      topRow.className = "answer-card-top";
      const badges = document.createElement("div");
      badges.className = "answer-badges";
      const categoryBadge = document.createElement("span");
      categoryBadge.className = "badge badge--category";
      categoryBadge.textContent = ANSWER_CATEGORY_LABELS[item.category];
      badges.appendChild(categoryBadge);
      if (item.requiresConfirmation) {
        const confirmBadge = document.createElement("span");
        confirmBadge.className = "badge badge--confirm";
        confirmBadge.textContent = "Requires confirmation";
        badges.appendChild(confirmBadge);
      }
      const actions = document.createElement("div");
      actions.className = "answer-card-actions";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-secondary btn-sm";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => {
        startEditingAnswer(item);
      });
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-danger btn-sm";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        void handleDeleteAnswer(item.id);
      });
      actions.append(editBtn, deleteBtn);
      topRow.append(badges, actions);
      const questionEl = document.createElement("p");
      questionEl.className = "answer-question";
      questionEl.textContent = item.question;
      const answerEl = document.createElement("p");
      answerEl.className = "answer-body";
      answerEl.textContent = item.answer;
      card.append(topRow, questionEl, answerEl);
      if (item.keywords.length > 0) {
        const keywordList = document.createElement("div");
        keywordList.className = "keyword-list";
        for (const kw of item.keywords) {
          const chip = document.createElement("span");
          chip.className = "keyword-chip";
          chip.textContent = kw;
          keywordList.appendChild(chip);
        }
        card.appendChild(keywordList);
      }
      container.appendChild(card);
    }
  }
  async function handleDeleteAnswer(answerId) {
    if (!window.confirm("Delete this saved application answer?")) {
      return;
    }
    setStatus("answer-status", "");
    const nextAnswers = applicationAnswers.filter((item) => item.id !== answerId);
    try {
      applicationAnswers = await saveApplicationAnswers(nextAnswers);
      if (editingAnswerId === answerId) {
        resetAnswerEditor();
      }
      renderAnswersList();
      setStatus("answer-status", "Answer deleted.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete answer.";
      setStatus("answer-status", message, "error");
    }
  }
  async function handleSaveAnswer(event) {
    event.preventDefault();
    setStatus("answer-status", "");
    const questionEl = document.getElementById("answer-question");
    const categoryEl = document.getElementById("answer-category");
    const keywordsEl = document.getElementById("answer-keywords");
    const answerEl = document.getElementById("answer-text");
    const confirmEl = document.getElementById(
      "answer-requires-confirmation"
    );
    const question = questionEl?.value.trim() ?? "";
    const answerText = answerEl?.value.trim() ?? "";
    if (!question || !answerText) {
      setStatus("answer-status", "Both the question and saved answer are required.", "error");
      return;
    }
    const category = categoryEl?.value ?? "general";
    const keywords = (keywordsEl?.value ?? "").split(",").map((part) => part.trim()).filter((part) => part.length > 0);
    const requiresConfirmation = Boolean(confirmEl?.checked);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let nextAnswers;
    const isUpdate = editingAnswerId !== null;
    if (isUpdate) {
      nextAnswers = applicationAnswers.map(
        (existing) => existing.id === editingAnswerId ? {
          ...existing,
          question,
          answer: answerText,
          category,
          keywords,
          requiresConfirmation,
          updatedAt: now
        } : existing
      );
    } else {
      const newEntry = {
        id: createLocalId("ans"),
        question,
        answer: answerText,
        category,
        keywords,
        requiresConfirmation,
        createdAt: now,
        updatedAt: now
      };
      nextAnswers = [newEntry, ...applicationAnswers];
    }
    try {
      applicationAnswers = await saveApplicationAnswers(nextAnswers);
      resetAnswerEditor();
      renderAnswersList();
      setStatus(
        "answer-status",
        isUpdate ? "Answer updated locally." : "Answer saved to library.",
        "success"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save application answer.";
      setStatus("answer-status", message, "error");
    }
  }
  function setupTabs() {
    const tabButtons = Array.from(document.querySelectorAll("[data-tab]"));
    const profileActionsBar = document.getElementById("profile-actions-bar");
    const activateTab = (tabKey) => {
      for (const btn of tabButtons) {
        const isMatch = btn.dataset.tab === tabKey;
        btn.classList.toggle("tab-btn--active", isMatch);
        btn.setAttribute("aria-selected", String(isMatch));
      }
      const allPanels = [
        "personal",
        "education",
        "employment",
        "links",
        "answers"
      ];
      for (const key of allPanels) {
        const panel = document.getElementById(`panel-${key}`);
        if (panel) {
          panel.hidden = key !== tabKey;
        }
      }
      if (profileActionsBar) {
        profileActionsBar.hidden = tabKey === "answers";
      }
    };
    for (const btn of tabButtons) {
      btn.addEventListener("click", () => {
        const key = btn.dataset.tab;
        if (key) {
          activateTab(key);
        }
      });
    }
  }
  async function initOptionsPage() {
    setupTabs();
    const profileForm = document.getElementById("profile-form");
    const clearBtn = document.getElementById("clear-btn");
    const addEducationBtn = document.getElementById("add-education-btn");
    const addEmploymentBtn = document.getElementById("add-employment-btn");
    const answerForm = document.getElementById("answer-form");
    const cancelAnswerBtn = document.getElementById("cancel-answer-btn");
    const filterCategoryEl = document.getElementById("filter-category");
    const filterSearchEl = document.getElementById("filter-search");
    try {
      const [savedProfile, savedAnswers] = await Promise.all([
        getUserProfile(),
        getApplicationAnswers()
      ]);
      populateProfileForm(savedProfile);
      applicationAnswers = savedAnswers;
      renderAnswersList();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load saved data from local storage.";
      setStatus("save-status", message, "error");
      setStatus("answer-status", message, "error");
    }
    addEducationBtn?.addEventListener("click", () => {
      educationEntries.push({
        id: createLocalId("edu"),
        institution: "",
        degree: "",
        specialization: "",
        startYear: "",
        graduationYear: "",
        cgpa: ""
      });
      renderEducationList();
    });
    addEmploymentBtn?.addEventListener("click", () => {
      employmentEntries.push({
        id: createLocalId("emp"),
        company: "",
        jobTitle: "",
        employmentType: "",
        startDate: "",
        endDate: "",
        currentlyWorking: false,
        responsibilities: ""
      });
      renderEmploymentList();
    });
    profileForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("save-status", "");
      try {
        const nextProfile = readProfileForm();
        const saved = await saveUserProfile(nextProfile);
        populateProfileForm(saved);
        setStatus("save-status", "Profile saved locally.", "success");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save profile.";
        setStatus("save-status", message, "error");
      }
    });
    clearBtn?.addEventListener("click", async () => {
      if (!window.confirm(
        "Clear all saved profile information? Your saved application answers will be preserved."
      )) {
        return;
      }
      setStatus("save-status", "");
      try {
        await clearUserProfile();
        populateProfileForm({
          ...DEFAULT_USER_PROFILE,
          personal: { ...DEFAULT_PERSONAL_INFO },
          education: [],
          employment: [],
          links: { ...DEFAULT_PROFESSIONAL_LINKS }
        });
        setStatus("save-status", "Saved profile data cleared (answers preserved).", "success");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to clear profile.";
        setStatus("save-status", message, "error");
      }
    });
    const answerCategoryEl = document.getElementById("answer-category");
    const answerConfirmEl = document.getElementById(
      "answer-requires-confirmation"
    );
    answerCategoryEl?.addEventListener("change", () => {
      if (editingAnswerId !== null || !answerConfirmEl) {
        return;
      }
      const val = answerCategoryEl.value;
      if (val === "work_authorization" || val === "sponsorship") {
        answerConfirmEl.checked = true;
      }
    });
    answerForm?.addEventListener("submit", (event) => {
      void handleSaveAnswer(event);
    });
    cancelAnswerBtn?.addEventListener("click", () => {
      resetAnswerEditor();
      setStatus("answer-status", "");
    });
    filterCategoryEl?.addEventListener("change", renderAnswersList);
    filterSearchEl?.addEventListener("input", renderAnswersList);
  }
  document.addEventListener("DOMContentLoaded", () => {
    void initOptionsPage();
  });
})();
