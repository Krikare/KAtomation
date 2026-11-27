# `src/storage/`

## Responsibility and Purpose

`src/storage/` isolates all `chrome.storage.local` persistence logic away from UI components and background/content scripts. Its goal is to read, normalize, migrate, save, and clear user data reliably without disturbing unrelated extension storage keys.

## Important Files

- **`profileStorage.ts`**: Exports the extension's local persistence API:
  - `getUserProfile()`: Reads `katomation_user_profile` and normalizes it into a complete `UserProfile` with safe defaults.
  - `saveUserProfile(profile)`: Merges and normalizes `UserProfile`, attaches an `updatedAt` ISO timestamp, preserves existing `workAuthorized` / `sponsorshipRequired` metadata if unset, and writes only `katomation_user_profile`.
  - `clearUserProfile()`: Removes only `katomation_user_profile` from `chrome.storage.local` so saved application answers remain intact.
  - `getApplicationAnswers()`: Reads `katomation_application_answers` and returns normalized `ApplicationAnswer[]` records.
  - `saveApplicationAnswers(answers)`: Normalizes and persists `ApplicationAnswer[]` under `katomation_application_answers` without touching profile data.

## Main Logic and Implementation Details

- **Backward-Compatible Migration**: `normalizeUserProfile()` detects Milestone 1 flat profile records (`LegacyMilestone1Profile`, such as `firstName`, `location`, `linkedinUrl`) and migrates them into the nested Milestone 2 schema (`personal`, `links`, `education`, `employment`) automatically.
- **Safe Defaults & Defensive Normalization**: Helper functions (`normalizePersonalInfo`, `normalizeLinks`, `normalizeEducationRecord`, `normalizeEmploymentRecord`, `normalizeApplicationAnswer`) ensure missing or malformed stored values fall back to safe defaults (for example, `currentlyWorking` defaults to `false` and clears `endDate` when `true`).
- **Key Isolation & Error Handling**: `chrome.storage.local.clear()` is never called; each operation targets only its own key in `STORAGE_KEYS`, and storage failures are rethrown with contextual error messages via `formatStorageError()`.

## Interactions with Other Modules

- Uses types and defaults from **`src/shared/`** (`types.ts`, `constants.ts`).
- Called directly by **`src/options/options.ts`** when loading, saving, or clearing the user's profile and application answer library.
