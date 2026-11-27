# `src/popup/`

## Responsibility and Purpose

`src/popup/` implements the **K{Atomation}** browser toolbar popup. It gives the user an immediate, minimal summary of whether the active browser tab is a supported recruitment platform and provides quick access to the Options page.

## Important Files

- **`popup.html`**: Defines the popup structure—brand header (`K{Atomation}`), ATS Detection card (`Platform`, `Page`, `Status`, and explanation), disabled **Auto-fill** placeholder button, **Settings** button, and manual-submission footer note.
- **`popup.css`**: Provides compact (`356px`), responsive styling and distinct badge/dot states (`unsupported`, `supported`, `application`).
- **`popup.ts`**: Handles UI initialization, background status querying, and opening the Options page.

## Main Logic and Implementation Details

- On `DOMContentLoaded`, `initPopup()` renders `INITIAL_DETECTION_STATE` (`Unknown` / `Not identified` / `Unsupported website`), attaches a click handler to `#settings-btn` that calls `chrome.runtime.openOptionsPage()`, and requests live status via `queryPlatformStatus()`.
- `queryPlatformStatus()` sends `{ type: 'GET_PLATFORM_STATUS' }` to the background service worker and updates the DOM via `renderDetectionState()`. If messaging fails, it safely retains `INITIAL_DETECTION_STATE`.
- `formatPageLabel()` translates `pageType` and `isApplicationPage` into user-friendly labels (`Job Application`, `Job Board / Careers`, `Platform Portal`, or `Not identified`).
- The **Auto-fill** button (`#autofill-btn`) remains intentionally `disabled` as a visual placeholder because form filling is not part of the current milestone.

## Interactions with Other Modules

- Requests `GET_PLATFORM_STATUS` from **`src/background/background.ts`**.
- Uses `INITIAL_DETECTION_STATE` from **`src/shared/constants.ts`** and detection types from **`src/shared/types.ts`**.
- Launches **`src/options/options.html`** via `chrome.runtime.openOptionsPage()`.
