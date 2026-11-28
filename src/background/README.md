# `src/background/`

## Responsibility and Purpose

`src/background/` contains the Manifest V3 background service worker for **K{Atomation}**. It initializes default local storage on installation, tracks per-tab ATS detection reports from content scripts, serves active-tab detection status requests from the popup, and coordinates Workday autofill (First Name, Last Name, and Email) between storage, the popup, and the content script.

## Important Files

- **`background.ts`**: Service worker entry point handling lifecycle events, tab cache cleanup, platform status resolution, and Workday autofill orchestration.

## Main Logic and Implementation Details

- **Storage Initialization (`chrome.runtime.onInstalled`)**: Seeds `katomation_user_profile` (`DEFAULT_USER_PROFILE`) and `katomation_application_answers` (`[]`) in `chrome.storage.local` only if they do not already exist, preserving previously saved user data across updates.
- **Per-Tab Detection Cache (`tabDetectionCache`)**: Stores `PlatformDetectionResult` objects keyed by `tabId` when `PLATFORM_DETECTION_REPORT` arrives from a content script. Removes entries on `chrome.tabs.onRemoved` and invalidates stale entries on `chrome.tabs.onUpdated` when `changeInfo.url` changes.
- **Active-Tab Resolution (`resolveActiveTabPlatform`)**:
  1. Queries the active tab via `{ active: true, lastFocusedWindow: true }` (falling back to `{ active: true, currentWindow: true }`).
  2. Returns a safe `unsupported` result immediately for restricted pages (`chrome://`, `chrome-extension://`, `edge://`, `about:`, `view-source:`, `devtools://`, Chrome Web Store) without trying to message a content script.
  3. Sends `DETECT_PLATFORM` to the active tab's content script via `chrome.tabs.sendMessage` for live DOM + URL inspection.
  4. If messaging fails (for example on unsupported sites or tabs opened before extension reload), uses a URL-matching cached result or falls back to `detectPlatformFromUrl(tabUrl)`. If `tabUrl` is unavailable, returns a safe fallback `unsupported` result.
- **Workday Basic Fields Autofill Workflow (`handleWorkdayFieldsAutofill`)**:
  1. Handles `AUTOFILL_WORKDAY_FIELDS` from `popup.ts`.
  2. Re-verifies that the active tab is a supported Workday application page (`platformId === 'workday' && isSupported && isApplicationPage`).
  3. Calls `getWorkdayBasicProfileValues()` in `src/storage/profileStorage.ts`; returns per-field `missing_profile` or `storage_error` results if unavailable.
  4. Sends `EXECUTE_WORKDAY_FIELDS_AUTOFILL` with `{ firstName, lastName, email }` to the active tab's content script and forwards the confirmed `WorkdayAutofillBatchResult` back to the popup.
  *(Also retains `AUTOFILL_WORKDAY_FIRST_NAME` / `handleWorkdayFirstNameAutofill` for backward compatibility.)*

## Interactions with Other Modules

- Uses `detectPlatformFromUrl()` and `createUnsupportedDetectionResult()` from **`src/adapters/registry.ts`**.
- Uses `getWorkdayBasicProfileValues()` and `getSavedFirstName()` from **`src/storage/profileStorage.ts`**.
- Uses `DEFAULT_USER_PROFILE` and `STORAGE_KEYS` from **`src/shared/constants.ts`**.
- Exchanges detection and autofill messages with **`src/content/content.ts`** and **`src/popup/popup.ts`**.
