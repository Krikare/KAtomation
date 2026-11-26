import { DEFAULT_USER_PROFILE } from '../shared/constants';
import type {
  SponsorshipOption,
  UserProfile,
  WorkAuthorizationOption,
} from '../shared/types';
import {
  clearUserProfile,
  getUserProfile,
  saveUserProfile,
} from '../storage/profileStorage';

const TEXT_FIELD_KEYS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'location',
  'linkedinUrl',
  'githubUrl',
  'portfolioUrl',
] as const;

function setStatusMessage(message: string, variant: 'success' | 'error' | 'neutral' = 'neutral'): void {
  const statusEl = document.getElementById('save-status');
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

function populateForm(profile: UserProfile): void {
  for (const key of TEXT_FIELD_KEYS) {
    const input = document.getElementById(key) as HTMLInputElement | null;
    if (input) {
      input.value = profile[key];
    }
  }

  const workAuthEl = document.getElementById('workAuthorized') as HTMLSelectElement | null;
  if (workAuthEl) {
    workAuthEl.value = profile.workAuthorized;
  }

  const sponsorshipEl = document.getElementById('sponsorshipRequired') as HTMLSelectElement | null;
  if (sponsorshipEl) {
    sponsorshipEl.value = profile.sponsorshipRequired;
  }
}

function readFormValues(): UserProfile {
  const profile: UserProfile = { ...DEFAULT_USER_PROFILE };

  for (const key of TEXT_FIELD_KEYS) {
    const input = document.getElementById(key) as HTMLInputElement | null;
    profile[key] = input?.value.trim() ?? '';
  }

  const workAuthEl = document.getElementById('workAuthorized') as HTMLSelectElement | null;
  profile.workAuthorized = (workAuthEl?.value ?? '') as WorkAuthorizationOption;

  const sponsorshipEl = document.getElementById('sponsorshipRequired') as HTMLSelectElement | null;
  profile.sponsorshipRequired = (sponsorshipEl?.value ?? '') as SponsorshipOption;

  return profile;
}

async function initOptionsPage(): Promise<void> {
  const form = document.getElementById('profile-form') as HTMLFormElement | null;
  const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement | null;

  if (!form) {
    return;
  }

  try {
    const savedProfile = await getUserProfile();
    populateForm(savedProfile);
  } catch {
    setStatusMessage('Unable to load saved profile from local storage.', 'error');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatusMessage('');

    try {
      const nextProfile = readFormValues();
      await saveUserProfile(nextProfile);
      setStatusMessage('Profile saved locally.', 'success');
    } catch {
      setStatusMessage('Failed to save profile.', 'error');
    }
  });

  clearBtn?.addEventListener('click', async () => {
    setStatusMessage('');

    try {
      await clearUserProfile();
      populateForm(DEFAULT_USER_PROFILE);
      setStatusMessage('Saved profile data cleared.', 'success');
    } catch {
      setStatusMessage('Failed to clear saved profile.', 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  void initOptionsPage();
});
