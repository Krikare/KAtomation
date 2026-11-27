# `src/background/`

## Responsibility and Purpose

`src/background/` contains the Manifest V3 background service worker for **K{Atomation}**. It initializes default local storage on installation, tracks per-tab ATS detection reports from content scripts, serves active-tab detection status requests from the popup, and coordinates Milestone 4.1 Workday First Name autofill between storage, the popup, and the content script.

## Important Files

- **`background.ts`**: Service worker entry point handling lifecycle events, tab cache cleanup, platform status resolution, and First Name autofill orchestration.

## Main Logic and Implementation Details

- **Storage Initialization (`chrome.runtime.onInstalled`)**: Seeds `katomation_user_profile` (`DEFAULT_USER_PROFILE`) and `katomation_application_answers` (`[]`) in `chrome.storage.local` only if they do not already exist, preserving previously saved user data across updates.
- **Per-Tab Detection Cache (`tabDetectionCache`)**: Stores `PlatformDetectionResult` objects keyed by `tabId` when `PLATFORM_DETECTION_REPORT` arrives from a content script. Removes entries on `chrome.tabs.onRemoved` and invalidates stale entries on `chrome.tabs.onUpdated` when `changeInfo.url` changes.
- **Active-Tab Resolution (`resolveActiveTabPlatform`)**:
  1. Queries the active tab via `{ active: true, lastFocusedWindow: true }` (falling back to `{ active: true, currentWindow: true }`).
  2. Returns a safe `unsupported` result immediately for restricted pages (`chrome://`, `chrome-extension://`, `edge://`, `about:`, `view-source:`, `devtools://`, Chrome Web Store) without trying to message a content script.
  3. Sends `DETECT_PLATFORM` to the active tab's content script via `chrome.tabs.sendMessage` for live DOM + URL inspection.
  4. If messaging fails (for example on unsupported sites or tabs opened before extension reload), uses a URL-matching cached result or falls back to `detectPlatformFromUrl(tabUrl)`. If `tabUrl` is unavailable, returns a safe fallback `unsupported` result.
- **Workday First Name Autofill Workflow (`handleWorkdayFirstNameAutofill`)**:
  1. Handles `AUTOFILL_WORKDAY_FIRST_NAME` from `popup.ts`.
  2. Re-verifies that the active tab is a supported Workday application page (`platformId === 'workday' && isSupported && isApplicationPage`).
  3. Calls `getSavedFirstName()` in `src/storage/profileStorage.ts`; returns early with `missing_profile`, `missing_first_name`, or `storage_error` if unavailable.
  4. Sends `EXECUTE_FIRST_NAME_AUTOFILL` with `firstName` to the active tab's content script and forwards the confirmed `AutofillFieldResult` back to the popup.

## Interactions with Other Modules

- Uses `detectPlatformFromUrl()` and `createUnsupportedDetectionResult()` from **`src/adapters/registry.ts`**.
- Uses `getSavedFirstName()` from **`src/storage/profileStorage.ts`**.
- Uses `DEFAULT_USER_PROFILE` and `STORAGE_KEYS` from **`src/shared/constants.ts`**.
- Exchanges `DETECT_PLATFORM`, `PLATFORM_DETECTION_REPORT`, `GET_PLATFORM_STATUS`, `AUTOFILL_WORKDAY_FIRST_NAME`, and `EXECUTE_FIRST_NAME_AUTOFILL` messages with **`src/content/content.ts`** and **`src/popup/popup.ts`**.
