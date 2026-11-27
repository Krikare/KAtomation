# `src/content/`

## Responsibility and Purpose

`src/content/` runs inside supported recruitment web pages (`*://*.myworkdayjobs.com/*`, `*://*.myworkday.com/*`, and `*://*.greenhouse.io/*` as configured in `manifest.json`) to perform passive ATS detection, report updates to the background service worker, and—when explicitly triggered by the user on a Workday application page—execute First Name autofill. It never submits forms, clicks navigation buttons, or fills any field other than First Name.

## Important Files

- **`content.ts`**: The compiled content script entry point injected at `document_idle`.

## Main Logic and Implementation Details

- **Initial & On-Demand Detection**: Runs `detectPlatformInDocument(document, window.location.href)` on initialization and whenever it receives a `DETECT_PLATFORM` runtime message from the background service worker.
- **Workday First Name Autofill (`EXECUTE_FIRST_NAME_AUTOFILL`)**: When requested by `background.ts`, calls `autofillWorkdayFirstName(document, window.location.href, message.firstName)` from `src/adapters/workdayAdapter.ts` and returns `{ ok: true, result }` with the confirmed `AutofillFieldResult`.
- **SPA Navigation Support**: Recruitment platforms frequently update views client-side without full page reloads. `content.ts` listens for `popstate` and `hashchange` events and attaches a `300ms`-debounced `MutationObserver` (`childList: true, subtree: true`) on `document.documentElement ?? document.body`.
- **Change Deduplication**: Computes a signature from `platformId`, `isSupported`, `isApplicationPage`, `pageType`, `url`, and `reason` (`getDetectionSignature`) so `PLATFORM_DETECTION_REPORT` messages are sent only when the detection state actually changes.

## Interactions with Other Modules

- Calls `detectPlatformInDocument()` from **`src/adapters/registry.ts`** and `autofillWorkdayFirstName()` from **`src/adapters/workdayAdapter.ts`**.
- Exchanges `DETECT_PLATFORM`, `PLATFORM_DETECTION_REPORT`, and `EXECUTE_FIRST_NAME_AUTOFILL` messages with **`src/background/background.ts`** using types from **`src/shared/types.ts`**.
