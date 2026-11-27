import {
  ANSWER_CATEGORY_LABELS,
  DEFAULT_PERSONAL_INFO,
  DEFAULT_PROFESSIONAL_LINKS,
  DEFAULT_USER_PROFILE,
  EMPLOYMENT_TYPE_LABELS,
} from '../shared/constants';
import type {
  AnswerCategory,
  ApplicationAnswer,
  EducationRecord,
  EmploymentRecord,
  EmploymentType,
  PersonalInfo,
  ProfessionalLinks,
  UserProfile,
} from '../shared/types';
import {
  clearUserProfile,
  getApplicationAnswers,
  getUserProfile,
  saveApplicationAnswers,
  saveUserProfile,
} from '../storage/profileStorage';

type TabKey = 'personal' | 'education' | 'employment' | 'links' | 'answers';

const PERSONAL_FIELD_KEYS: readonly (keyof PersonalInfo)[] = [
  'firstName',
  'middleName',
  'lastName',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'country',
  'postalCode',
];

const LINK_FIELD_KEYS: readonly (keyof ProfessionalLinks)[] = [
  'linkedinUrl',
  'githubUrl',
  'portfolioUrl',
];

let educationEntries: EducationRecord[] = [];
let employmentEntries: EmploymentRecord[] = [];
let applicationAnswers: ApplicationAnswer[] = [];
let editingAnswerId: string | null = null;
let loadedProfileMeta: Pick<UserProfile, 'workAuthorized' | 'sponsorshipRequired'> = {
  workAuthorized: '',
  sponsorshipRequired: '',
};

function createLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function setStatus(
  elementId: 'save-status' | 'answer-status',
  message: string,
  variant: 'success' | 'error' | 'neutral' = 'neutral',
): void {
  const statusEl = document.getElementById(elementId);
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.className = 'save-status';
  if (variant === 'success') {
    statusEl.classList.add('save-status--success');
  } else if (variant === 'error') {
    statusEl.classList.add('save-status--error');
  }
}

function createField(
  labelText: string,
  control: HTMLElement,
  fullWidth = false,
): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = fullWidth ? 'field field--full' : 'field';

  const label = document.createElement('label');
  if (control.id) {
    label.htmlFor = control.id;
  }
  label.textContent = labelText;

  wrapper.append(label, control);
  return wrapper;
}

function createTextInput(
  id: string,
  value: string,
  placeholder: string,
  onInput: (nextValue: string) => void,
): HTMLInputElement {
  const input = document.createElement('input');
  input.id = id;
  input.type = 'text';
  input.value = value;
  input.placeholder = placeholder;
  input.addEventListener('input', () => {
    onInput(input.value);
  });
  return input;
}

function createEmptyState(message: string): HTMLDivElement {
  const box = document.createElement('div');
  box.className = 'empty-state';
  box.textContent = message;
  return box;
}

function renderEducationList(): void {
  const container = document.getElementById('education-list');
  if (!container) {
    return;
  }

  container.replaceChildren();

  if (educationEntries.length === 0) {
    container.appendChild(
      createEmptyState('No education records added yet. Click "+ Add Education" to add one.'),
    );
    return;
  }

  educationEntries.forEach((entry, index) => {
    const card = document.createElement('div');
    card.className = 'entry-card';

    const header = document.createElement('div');
    header.className = 'entry-card-header';

    const title = document.createElement('h3');
    title.className = 'entry-card-title';
    title.textContent = `Education #${index + 1}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-danger btn-sm';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      const hasData = Boolean(
        entry.institution.trim() ||
          entry.degree.trim() ||
          entry.specialization.trim() ||
          entry.startYear.trim() ||
          entry.graduationYear.trim() ||
          entry.cgpa.trim(),
      );
      if (hasData && !window.confirm(`Remove Education #${index + 1}?`)) {
        return;
      }
      educationEntries = educationEntries.filter((item) => item.id !== entry.id);
      renderEducationList();
    });

    header.append(title, removeBtn);

    const grid = document.createElement('div');
    grid.className = 'field-grid';

    grid.append(
      createField(
        'Institution',
        createTextInput(`edu-inst-${entry.id}`, entry.institution, 'State University', (val) => {
          entry.institution = val;
        }),
        true,
      ),
      createField(
        'Degree',
        createTextInput(`edu-deg-${entry.id}`, entry.degree, 'Bachelor of Science', (val) => {
          entry.degree = val;
        }),
      ),
      createField(
        'Specialization / Major',
        createTextInput(
          `edu-spec-${entry.id}`,
          entry.specialization,
          'Computer Science',
          (val) => {
            entry.specialization = val;
          },
        ),
      ),
      createField(
        'Start Year',
        createTextInput(`edu-start-${entry.id}`, entry.startYear, '2020', (val) => {
          entry.startYear = val;
        }),
      ),
      createField(
        'Graduation Year',
        createTextInput(`edu-grad-${entry.id}`, entry.graduationYear, '2024', (val) => {
          entry.graduationYear = val;
        }),
      ),
      createField(
        'CGPA / GPA',
        createTextInput(`edu-cgpa-${entry.id}`, entry.cgpa, '3.85 / 4.0', (val) => {
          entry.cgpa = val;
        }),
      ),
    );

    card.append(header, grid);
    container.appendChild(card);
  });
}

function renderEmploymentList(): void {
  const container = document.getElementById('employment-list');
  if (!container) {
    return;
  }

  container.replaceChildren();

  if (employmentEntries.length === 0) {
    container.appendChild(
      createEmptyState('No employment records added yet. Click "+ Add Employment" to add one.'),
    );
    return;
  }

  employmentEntries.forEach((entry, index) => {
    const card = document.createElement('div');
    card.className = 'entry-card';

    const header = document.createElement('div');
    header.className = 'entry-card-header';

    const title = document.createElement('h3');
    title.className = 'entry-card-title';
    title.textContent = `Employment #${index + 1}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-danger btn-sm';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      const hasData = Boolean(
        entry.company.trim() ||
          entry.jobTitle.trim() ||
          entry.employmentType ||
          entry.startDate.trim() ||
          entry.endDate.trim() ||
          entry.currentlyWorking ||
          entry.responsibilities.trim(),
      );
      if (hasData && !window.confirm(`Remove Employment #${index + 1}?`)) {
        return;
      }
      employmentEntries = employmentEntries.filter((item) => item.id !== entry.id);
      renderEmploymentList();
    });

    header.append(title, removeBtn);

    const typeSelect = document.createElement('select');
    typeSelect.id = `emp-type-${entry.id}`;
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Select employment type';
    typeSelect.appendChild(placeholderOption);

    for (const [value, label] of Object.entries(EMPLOYMENT_TYPE_LABELS)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      typeSelect.appendChild(option);
    }
    typeSelect.value = entry.employmentType;
    typeSelect.addEventListener('change', () => {
      entry.employmentType = typeSelect.value as EmploymentType;
    });

    const endDateInput = createTextInput(
      `emp-end-${entry.id}`,
      entry.currentlyWorking ? '' : entry.endDate,
      entry.currentlyWorking ? 'Present' : '2025-08',
      (val) => {
        entry.endDate = val;
      },
    );
    endDateInput.disabled = entry.currentlyWorking;

    const currentCheckbox = document.createElement('input');
    currentCheckbox.id = `emp-current-${entry.id}`;
    currentCheckbox.type = 'checkbox';
    currentCheckbox.checked = entry.currentlyWorking;
    currentCheckbox.addEventListener('change', () => {
      entry.currentlyWorking = currentCheckbox.checked;
      endDateInput.disabled = entry.currentlyWorking;
      if (entry.currentlyWorking) {
        entry.endDate = '';
        endDateInput.value = '';
        endDateInput.placeholder = 'Present';
      } else {
        endDateInput.placeholder = '2025-08';
      }
    });

    const currentLabel = document.createElement('label');
    currentLabel.className = 'checkbox-row';
    currentLabel.htmlFor = currentCheckbox.id;
    const currentLabelText = document.createElement('span');
    currentLabelText.textContent = 'Currently working here';
    currentLabel.append(currentCheckbox, currentLabelText);

    const currentFieldWrapper = document.createElement('div');
    currentFieldWrapper.className = 'field field--full';
    currentFieldWrapper.appendChild(currentLabel);

    const responsibilitiesEl = document.createElement('textarea');
    responsibilitiesEl.id = `emp-resp-${entry.id}`;
    responsibilitiesEl.rows = 3;
    responsibilitiesEl.value = entry.responsibilities;
    responsibilitiesEl.placeholder = 'Key achievements, systems built, or responsibilities...';
    responsibilitiesEl.addEventListener('input', () => {
      entry.responsibilities = responsibilitiesEl.value;
    });

    const grid = document.createElement('div');
    grid.className = 'field-grid';

    grid.append(
      createField(
        'Company',
        createTextInput(`emp-comp-${entry.id}`, entry.company, 'Acme Corp', (val) => {
          entry.company = val;
        }),
      ),
      createField(
        'Job Title',
        createTextInput(`emp-title-${entry.id}`, entry.jobTitle, 'Software Engineer', (val) => {
          entry.jobTitle = val;
        }),
      ),
      createField('Employment Type', typeSelect),
      createField(
        'Start Date',
        createTextInput(`emp-start-${entry.id}`, entry.startDate, '2023-06', (val) => {
          entry.startDate = val;
        }),
      ),
      createField('End Date', endDateInput),
      currentFieldWrapper,
      createField('Responsibilities', responsibilitiesEl, true),
    );

    card.append(header, grid);
    container.appendChild(card);
  });
}

function populateProfileForm(profile: UserProfile): void {
  for (const key of PERSONAL_FIELD_KEYS) {
    const input = document.getElementById(key) as HTMLInputElement | null;
    if (input) {
      input.value = profile.personal[key];
    }
  }

  for (const key of LINK_FIELD_KEYS) {
    const input = document.getElementById(key) as HTMLInputElement | null;
    if (input) {
      input.value = profile.links[key];
    }
  }

  educationEntries = profile.education.map((item) => ({ ...item }));
  employmentEntries = profile.employment.map((item) => ({ ...item }));
  loadedProfileMeta = {
    workAuthorized: profile.workAuthorized,
    sponsorshipRequired: profile.sponsorshipRequired,
  };

  renderEducationList();
  renderEmploymentList();
}

function readProfileForm(): UserProfile {
  const personal: PersonalInfo = { ...DEFAULT_PERSONAL_INFO };
  for (const key of PERSONAL_FIELD_KEYS) {
    const input = document.getElementById(key) as HTMLInputElement | null;
    personal[key] = input?.value.trim() ?? '';
  }

  const links: ProfessionalLinks = { ...DEFAULT_PROFESSIONAL_LINKS };
  for (const key of LINK_FIELD_KEYS) {
    const input = document.getElementById(key) as HTMLInputElement | null;
    links[key] = input?.value.trim() ?? '';
  }

  const education: EducationRecord[] = educationEntries.map((item) => ({
    id: item.id,
    institution: item.institution.trim(),
    degree: item.degree.trim(),
    specialization: item.specialization.trim(),
    startYear: item.startYear.trim(),
    graduationYear: item.graduationYear.trim(),
    cgpa: item.cgpa.trim(),
  }));

  const employment: EmploymentRecord[] = employmentEntries.map((item) => ({
    id: item.id,
    company: item.company.trim(),
    jobTitle: item.jobTitle.trim(),
    employmentType: item.employmentType,
    startDate: item.startDate.trim(),
    endDate: item.currentlyWorking ? '' : item.endDate.trim(),
    currentlyWorking: item.currentlyWorking,
    responsibilities: item.responsibilities.trim(),
  }));

  return {
    personal,
    education,
    employment,
    links,
    workAuthorized: loadedProfileMeta.workAuthorized,
    sponsorshipRequired: loadedProfileMeta.sponsorshipRequired,
  };
}

function resetAnswerEditor(): void {
  editingAnswerId = null;

  const titleEl = document.getElementById('answer-form-title');
  const saveBtn = document.getElementById('save-answer-btn');
  const cancelBtn = document.getElementById('cancel-answer-btn') as HTMLButtonElement | null;
  const questionEl = document.getElementById('answer-question') as HTMLInputElement | null;
  const categoryEl = document.getElementById('answer-category') as HTMLSelectElement | null;
  const keywordsEl = document.getElementById('answer-keywords') as HTMLInputElement | null;
  const answerEl = document.getElementById('answer-text') as HTMLTextAreaElement | null;
  const confirmEl = document.getElementById(
    'answer-requires-confirmation',
  ) as HTMLInputElement | null;

  if (titleEl) titleEl.textContent = 'Add Application Answer';
  if (saveBtn) saveBtn.textContent = 'Save Answer';
  if (cancelBtn) cancelBtn.hidden = true;
  if (questionEl) questionEl.value = '';
  if (categoryEl) categoryEl.value = 'general';
  if (keywordsEl) keywordsEl.value = '';
  if (answerEl) answerEl.value = '';
  if (confirmEl) confirmEl.checked = false;
}

function startEditingAnswer(answer: ApplicationAnswer): void {
  editingAnswerId = answer.id;

  const titleEl = document.getElementById('answer-form-title');
  const saveBtn = document.getElementById('save-answer-btn');
  const cancelBtn = document.getElementById('cancel-answer-btn') as HTMLButtonElement | null;
  const questionEl = document.getElementById('answer-question') as HTMLInputElement | null;
  const categoryEl = document.getElementById('answer-category') as HTMLSelectElement | null;
  const keywordsEl = document.getElementById('answer-keywords') as HTMLInputElement | null;
  const answerEl = document.getElementById('answer-text') as HTMLTextAreaElement | null;
  const confirmEl = document.getElementById(
    'answer-requires-confirmation',
  ) as HTMLInputElement | null;

  if (titleEl) titleEl.textContent = 'Edit Application Answer';
  if (saveBtn) saveBtn.textContent = 'Update Answer';
  if (cancelBtn) cancelBtn.hidden = false;
  if (questionEl) questionEl.value = answer.question;
  if (categoryEl) categoryEl.value = answer.category;
  if (keywordsEl) keywordsEl.value = answer.keywords.join(', ');
  if (answerEl) answerEl.value = answer.answer;
  if (confirmEl) confirmEl.checked = answer.requiresConfirmation;

  setStatus('answer-status', '');
  questionEl?.focus();
}

function renderAnswersList(): void {
  const container = document.getElementById('answers-list');
  const countEl = document.getElementById('answers-count');
  const filterCategoryEl = document.getElementById('filter-category') as HTMLSelectElement | null;
  const filterSearchEl = document.getElementById('filter-search') as HTMLInputElement | null;

  if (!container) {
    return;
  }

  const categoryFilter = filterCategoryEl?.value ?? 'all';
  const searchTerm = (filterSearchEl?.value ?? '').trim().toLowerCase();

  const filtered = applicationAnswers.filter((entry) => {
    if (categoryFilter !== 'all' && entry.category !== categoryFilter) {
      return false;
    }

    if (!searchTerm) {
      return true;
    }

    const haystack = [
      entry.question,
      entry.answer,
      ANSWER_CATEGORY_LABELS[entry.category],
      ...entry.keywords,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(searchTerm);
  });

  if (countEl) {
    const total = applicationAnswers.length;
    const shown = filtered.length;
    countEl.textContent =
      shown === total
        ? `${total} saved ${total === 1 ? 'answer' : 'answers'}`
        : `Showing ${shown} of ${total} saved answers`;
  }

  container.replaceChildren();

  if (applicationAnswers.length === 0) {
    container.appendChild(
      createEmptyState('No saved application answers yet. Add your first answer above.'),
    );
    return;
  }

  if (filtered.length === 0) {
    container.appendChild(
      createEmptyState('No saved answers match the current category or search filter.'),
    );
    return;
  }

  for (const item of filtered) {
    const card = document.createElement('article');
    card.className = 'answer-card';

    const topRow = document.createElement('div');
    topRow.className = 'answer-card-top';

    const badges = document.createElement('div');
    badges.className = 'answer-badges';

    const categoryBadge = document.createElement('span');
    categoryBadge.className = 'badge badge--category';
    categoryBadge.textContent = ANSWER_CATEGORY_LABELS[item.category];
    badges.appendChild(categoryBadge);

    if (item.requiresConfirmation) {
      const confirmBadge = document.createElement('span');
      confirmBadge.className = 'badge badge--confirm';
      confirmBadge.textContent = 'Requires confirmation';
      badges.appendChild(confirmBadge);
    }

    const actions = document.createElement('div');
    actions.className = 'answer-card-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-secondary btn-sm';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      startEditingAnswer(item);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger btn-sm';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      void handleDeleteAnswer(item.id);
    });

    actions.append(editBtn, deleteBtn);
    topRow.append(badges, actions);

    const questionEl = document.createElement('p');
    questionEl.className = 'answer-question';
    questionEl.textContent = item.question;

    const answerEl = document.createElement('p');
    answerEl.className = 'answer-body';
    answerEl.textContent = item.answer;

    card.append(topRow, questionEl, answerEl);

    if (item.keywords.length > 0) {
      const keywordList = document.createElement('div');
      keywordList.className = 'keyword-list';
      for (const kw of item.keywords) {
        const chip = document.createElement('span');
        chip.className = 'keyword-chip';
        chip.textContent = kw;
        keywordList.appendChild(chip);
      }
      card.appendChild(keywordList);
    }

    container.appendChild(card);
  }
}

async function handleDeleteAnswer(answerId: string): Promise<void> {
  if (!window.confirm('Delete this saved application answer?')) {
    return;
  }

  setStatus('answer-status', '');
  const nextAnswers = applicationAnswers.filter((item) => item.id !== answerId);

  try {
    applicationAnswers = await saveApplicationAnswers(nextAnswers);
    if (editingAnswerId === answerId) {
      resetAnswerEditor();
    }
    renderAnswersList();
    setStatus('answer-status', 'Answer deleted.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete answer.';
    setStatus('answer-status', message, 'error');
  }
}

async function handleSaveAnswer(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  setStatus('answer-status', '');

  const questionEl = document.getElementById('answer-question') as HTMLInputElement | null;
  const categoryEl = document.getElementById('answer-category') as HTMLSelectElement | null;
  const keywordsEl = document.getElementById('answer-keywords') as HTMLInputElement | null;
  const answerEl = document.getElementById('answer-text') as HTMLTextAreaElement | null;
  const confirmEl = document.getElementById(
    'answer-requires-confirmation',
  ) as HTMLInputElement | null;

  const question = questionEl?.value.trim() ?? '';
  const answerText = answerEl?.value.trim() ?? '';

  if (!question || !answerText) {
    setStatus('answer-status', 'Both the question and saved answer are required.', 'error');
    return;
  }

  const category = (categoryEl?.value ?? 'general') as AnswerCategory;
  const keywords = (keywordsEl?.value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const requiresConfirmation = Boolean(confirmEl?.checked);
  const now = new Date().toISOString();

  let nextAnswers: ApplicationAnswer[];
  const isUpdate = editingAnswerId !== null;

  if (isUpdate) {
    nextAnswers = applicationAnswers.map((existing) =>
      existing.id === editingAnswerId
        ? {
            ...existing,
            question,
            answer: answerText,
            category,
            keywords,
            requiresConfirmation,
            updatedAt: now,
          }
        : existing,
    );
  } else {
    const newEntry: ApplicationAnswer = {
      id: createLocalId('ans'),
      question,
      answer: answerText,
      category,
      keywords,
      requiresConfirmation,
      createdAt: now,
      updatedAt: now,
    };
    nextAnswers = [newEntry, ...applicationAnswers];
  }

  try {
    applicationAnswers = await saveApplicationAnswers(nextAnswers);
    resetAnswerEditor();
    renderAnswersList();
    setStatus(
      'answer-status',
      isUpdate ? 'Answer updated locally.' : 'Answer saved to library.',
      'success',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save application answer.';
    setStatus('answer-status', message, 'error');
  }
}

function setupTabs(): void {
  const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tab]'));
  const profileActionsBar = document.getElementById('profile-actions-bar');

  const activateTab = (tabKey: TabKey) => {
    for (const btn of tabButtons) {
      const isMatch = btn.dataset.tab === tabKey;
      btn.classList.toggle('tab-btn--active', isMatch);
      btn.setAttribute('aria-selected', String(isMatch));
    }

    const allPanels: readonly TabKey[] = [
      'personal',
      'education',
      'employment',
      'links',
      'answers',
    ];
    for (const key of allPanels) {
      const panel = document.getElementById(`panel-${key}`);
      if (panel) {
        panel.hidden = key !== tabKey;
      }
    }

    if (profileActionsBar) {
      profileActionsBar.hidden = tabKey === 'answers';
    }
  };

  for (const btn of tabButtons) {
    btn.addEventListener('click', () => {
      const key = btn.dataset.tab as TabKey | undefined;
      if (key) {
        activateTab(key);
      }
    });
  }
}

async function initOptionsPage(): Promise<void> {
  setupTabs();

  const profileForm = document.getElementById('profile-form') as HTMLFormElement | null;
  const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement | null;
  const addEducationBtn = document.getElementById('add-education-btn');
  const addEmploymentBtn = document.getElementById('add-employment-btn');
  const answerForm = document.getElementById('answer-form') as HTMLFormElement | null;
  const cancelAnswerBtn = document.getElementById('cancel-answer-btn');
  const filterCategoryEl = document.getElementById('filter-category');
  const filterSearchEl = document.getElementById('filter-search');

  try {
    const [savedProfile, savedAnswers] = await Promise.all([
      getUserProfile(),
      getApplicationAnswers(),
    ]);
    populateProfileForm(savedProfile);
    applicationAnswers = savedAnswers;
    renderAnswersList();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load saved data from local storage.';
    setStatus('save-status', message, 'error');
    setStatus('answer-status', message, 'error');
  }

  addEducationBtn?.addEventListener('click', () => {
    educationEntries.push({
      id: createLocalId('edu'),
      institution: '',
      degree: '',
      specialization: '',
      startYear: '',
      graduationYear: '',
      cgpa: '',
    });
    renderEducationList();
  });

  addEmploymentBtn?.addEventListener('click', () => {
    employmentEntries.push({
      id: createLocalId('emp'),
      company: '',
      jobTitle: '',
      employmentType: '',
      startDate: '',
      endDate: '',
      currentlyWorking: false,
      responsibilities: '',
    });
    renderEmploymentList();
  });

  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('save-status', '');

    try {
      const nextProfile = readProfileForm();
      const saved = await saveUserProfile(nextProfile);
      populateProfileForm(saved);
      setStatus('save-status', 'Profile saved locally.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save profile.';
      setStatus('save-status', message, 'error');
    }
  });

  clearBtn?.addEventListener('click', async () => {
    if (
      !window.confirm(
        'Clear all saved profile information? Your saved application answers will be preserved.',
      )
    ) {
      return;
    }

    setStatus('save-status', '');

    try {
      await clearUserProfile();
      populateProfileForm({
        ...DEFAULT_USER_PROFILE,
        personal: { ...DEFAULT_PERSONAL_INFO },
        education: [],
        employment: [],
        links: { ...DEFAULT_PROFESSIONAL_LINKS },
      });
      setStatus('save-status', 'Saved profile data cleared (answers preserved).', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear profile.';
      setStatus('save-status', message, 'error');
    }
  });

  const answerCategoryEl = document.getElementById('answer-category') as HTMLSelectElement | null;
  const answerConfirmEl = document.getElementById(
    'answer-requires-confirmation',
  ) as HTMLInputElement | null;

  answerCategoryEl?.addEventListener('change', () => {
    if (editingAnswerId !== null || !answerConfirmEl) {
      return;
    }
    const val = answerCategoryEl.value as AnswerCategory;
    if (val === 'work_authorization' || val === 'sponsorship') {
      answerConfirmEl.checked = true;
    }
  });

  answerForm?.addEventListener('submit', (event) => {
    void handleSaveAnswer(event);
  });

  cancelAnswerBtn?.addEventListener('click', () => {
    resetAnswerEditor();
    setStatus('answer-status', '');
  });

  filterCategoryEl?.addEventListener('change', renderAnswersList);
  filterSearchEl?.addEventListener('input', renderAnswersList);
}

document.addEventListener('DOMContentLoaded', () => {
  void initOptionsPage();
});
