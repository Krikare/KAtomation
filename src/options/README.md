# `src/options/`

## Responsibility and Purpose

`src/options/` implements the **K{Atomation}** Profile & Application Answer Engine settings page (`options_page` in `manifest.json`). It provides a clean, local-only UI where users configure reusable personal, education, employment, link, and Q&A library data stored in `chrome.storage.local`.

## Important Files

- **`options.html`**: Defines the five-tab layout (`Personal Info`, `Education`, `Employment`, `Professional Links`, and `Application Answers`), profile action bar (**Save Profile**, **Clear Profile Data**), answer editor form, and filterable answers list.
- **`options.css`**: Responsive layout, card styling, tab states, form controls, and confirmation/category badges.
- **`options.ts`**: Manages tab switching, dynamic repeatable entry rendering, form serialization/deserialization, confirmation prompts, and storage integration.

## Main Logic and Implementation Details

- **Tab Isolation & Atomic Saves**: Tabs 1–4 (`Personal Info`, `Education`, `Employment`, `Professional Links`) belong to `#profile-form` and persist together via `saveUserProfile()`. Tab 5 (`Application Answers`) operates independently via `#answer-form` and `saveApplicationAnswers()`. Saving or clearing one never overwrites the other.
- **Repeatable Education & Employment Records**: Users can add and remove multiple `EducationRecord` and `EmploymentRecord` cards dynamically. Checking **Currently working here** on an employment record disables and clears its **End Date** field.
- **Application Answer Library**: Supports adding, editing, deleting, filtering by `AnswerCategory`, and searching by question/answer/keywords. Selecting `work_authorization` or `sponsorship` defaults `requiresConfirmation` to `true` for new answers so legal/eligibility attestations require explicit confirmation. Answers are never auto-invented.
- **Accidental Deletion Guards & Safe DOM Rendering**: Uses `window.confirm` before removing populated education/employment cards, deleting saved answers, or clearing profile data, and builds dynamic cards with `document.createElement` and `textContent` (avoiding raw `innerHTML` interpolation).

## Interactions with Other Modules

- Calls `getUserProfile()`, `saveUserProfile()`, `clearUserProfile()`, `getApplicationAnswers()`, and `saveApplicationAnswers()` from **`src/storage/profileStorage.ts`**.
- Uses shared interfaces and label constants from **`src/shared/types.ts`** and **`src/shared/constants.ts`**.
- Opened from **`src/popup/popup.ts`** via `chrome.runtime.openOptionsPage()` or from `chrome://extensions`.
