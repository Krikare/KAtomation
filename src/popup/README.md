# `src/popup/`

## Responsibility and Purpose

`src/popup/` implements the **K{Atomation}** browser toolbar popup. It gives the user an immediate, minimal summary of whether the active browser tab is a supported recruitment platform and provides quick access to the Options page.

## Important Files

- **`popup.html`**: Defines the popup structure—brand header (`K{Atomation}`), ATS Detection card (`Platform`, `Page`, `Status`, and explanation), **Auto-fill** button (`#autofill-btn`), inline status feedback area (`#autofill-feedback`), **Settings** button, and manual-submission footer note.
- **`popup.css`**: Provides compact (`356px`), responsive styling, distinct detection badge/dot states (`unsupported`, `supported`, `application`), and feedback styles (`success`, `warning`, `error`).
- **`popup.ts`**: Handles UI initialization, background status querying, conditional **Auto-fill** activation, autofill triggering/feedback, and opening the Options page.

## Main Logic and Implementation Details

- On `DOMContentLoaded`, `initPopup()` renders `INITIAL_DETECTION_STATE` (`Unknown` / `Not identified` / `Unsupported website`), attaches click handlers for `#autofill-btn` and `#settings-btn`, and requests live status via `queryPlatformStatus()`.
- `queryPlatformStatus()` sends `{ type: 'GET_PLATFORM_STATUS' }` to the background service worker and updates the DOM via `renderDetectionState()`. If messaging fails, it safely retains `INITIAL_DETECTION_STATE`.
- `updateAutofillButtonState()` enables `#autofill-btn` **only** when `platformId === 'workday' && isSupported && isApplicationPage`. For Greenhouse, non-application pages, and unsupported websites, `#autofill-btn` remains disabled.
- `handleAutofillClick()` disables the button while in-flight, sends `{ type: 'AUTOFILL_WORKDAY_FIRST_NAME' }` to `background.ts`, and renders `#autofill-feedback` only after receiving the confirmed `AutofillFieldResult` (e.g., `"First Name filled successfully."`, `"First Name is missing from your profile."`, `"First Name field could not be identified."`, or `"Field already contains a value."`).
- `formatPageLabel()` translates `pageType` and `isApplicationPage` into user-friendly labels (`Job Application`, `Job Board / Careers`, `Platform Portal`, or `Not identified`).

## Interactions with Other Modules

- Requests `GET_PLATFORM_STATUS` and `AUTOFILL_WORKDAY_FIRST_NAME` from **`src/background/background.ts`**.
- Uses `INITIAL_DETECTION_STATE` from **`src/shared/constants.ts`** and detection/autofill types from **`src/shared/types.ts`**.
- Launches **`src/options/options.html`** via `chrome.runtime.openOptionsPage()`.
