# `src/popup/`

## Responsibility and Purpose

`src/popup/` implements the **K{Atomation}** browser toolbar popup. It gives the user an immediate, minimal summary of whether the active browser tab is a supported recruitment platform and provides quick access to the Options page.

## Important Files

- **`popup.html`**: Defines the popup structure—brand header (`K{Atomation}`), ATS Detection card (`Platform`, `Page`, `Status`, and explanation), **Auto-fill** button (`#autofill-btn`), multi-field feedback container (`#autofill-feedback`), **Settings** button, and manual-submission footer note.
- **`popup.css`**: Provides compact (`356px`), responsive styling, distinct detection badge/dot states (`unsupported`, `supported`, `application`), and per-field feedback rows (`success`, `warning`, `error`).
- **`popup.ts`**: Handles UI initialization, background status querying, conditional **Auto-fill** activation, batch autofill triggering, per-field status rendering, and opening the Options page.

## Main Logic and Implementation Details

- On `DOMContentLoaded`, `initPopup()` renders `INITIAL_DETECTION_STATE` (`Unknown` / `Not identified` / `Unsupported website`), attaches click handlers for `#autofill-btn` and `#settings-btn`, and requests live status via `queryPlatformStatus()`.
- `queryPlatformStatus()` sends `{ type: 'GET_PLATFORM_STATUS' }` to the background service worker and updates the DOM via `renderDetectionState()`. If messaging fails, it safely retains `INITIAL_DETECTION_STATE`.
- `updateAutofillButtonState()` enables `#autofill-btn` **only** when `platformId === 'workday' && isSupported && isApplicationPage`. For Greenhouse, non-application pages, and unsupported websites, `#autofill-btn` remains disabled.
- `handleAutofillClick()` disables the button while in-flight, sends `{ type: 'AUTOFILL_WORKDAY_FIELDS' }` to `background.ts`, and renders individual status rows in `#autofill-feedback` (`First Name`, `Last Name`, `Email`) only after receiving the confirmed `WorkdayAutofillBatchResult` (`Filled successfully.`, `Already populated.`, `Missing from profile.`, `Field not found.`, `Field ambiguous.`, `Unsupported page.`, or `Storage error.`).
- `formatPageLabel()` translates `pageType` and `isApplicationPage` into user-friendly labels (`Job Application`, `Job Board / Careers`, `Platform Portal`, or `Not identified`).

## Interactions with Other Modules

- Requests `GET_PLATFORM_STATUS` and `AUTOFILL_WORKDAY_FIELDS` from **`src/background/background.ts`**.
- Uses `INITIAL_DETECTION_STATE` from **`src/shared/constants.ts`** and detection/autofill types from **`src/shared/types.ts`**.
- Launches **`src/options/options.html`** via `chrome.runtime.openOptionsPage()`.
