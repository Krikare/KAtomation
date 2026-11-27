# `src/content/`

## Responsibility and Purpose

`src/content/` runs inside supported recruitment web pages (`*://*.myworkdayjobs.com/*`, `*://*.myworkday.com/*`, and `*://*.greenhouse.io/*` as configured in `manifest.json`) to perform passive ATS detection and report updates to the background service worker. It never modifies webpage DOM elements or autofills form inputs.

## Important Files

- **`content.ts`**: The compiled content script entry point injected at `document_idle`.

## Main Logic and Implementation Details

- **Initial & On-Demand Detection**: Runs `detectPlatformInDocument(document, window.location.href)` on initialization and whenever it receives a `DETECT_PLATFORM` runtime message from the background service worker.
- **SPA Navigation Support**: Recruitment platforms frequently update views client-side without full page reloads. `content.ts` listens for `popstate` and `hashchange` events and attaches a `300ms`-debounced `MutationObserver` (`childList: true, subtree: true`) on `document.documentElement ?? document.body`.
- **Change Deduplication**: Computes a signature from `platformId`, `isSupported`, `isApplicationPage`, `pageType`, `url`, and `reason` (`getDetectionSignature`) so `PLATFORM_DETECTION_REPORT` messages are sent only when the detection state actually changes.

## Interactions with Other Modules

- Calls `detectPlatformInDocument()` from **`src/adapters/registry.ts`**.
- Sends `PLATFORM_DETECTION_REPORT` messages to and responds to `DETECT_PLATFORM` messages from **`src/background/background.ts`** using types from **`src/shared/types.ts`**.
