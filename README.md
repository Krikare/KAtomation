# K{Atomation}

Universal Job Application Autofill — Chrome Extension (Manifest V3).

> **Current Milestone:** Milestone 1 — Extension Foundation  
> Scope: Extension structure, Manifest V3 configuration, TypeScript build pipeline, popup UI (with passive platform detection and placeholder Auto-fill action), and local profile settings page. Form filling, backend services, and AI features are intentionally excluded from this milestone.

## Project Structure

```text
KAtomation/
├── src/
│   ├── popup/          # Extension popup UI (HTML, CSS, TS)
│   ├── options/        # Profile settings page (HTML, CSS, TS)
│   ├── background/     # MV3 background service worker
│   ├── content/        # Passive content script for ATS detection
│   ├── adapters/       # Independent ATS platform adapters (Workday, Greenhouse)
│   ├── storage/        # chrome.storage.local persistence layer
│   └── shared/         # Shared types and constants
├── public/
│   └── icons/          # Extension icons (16x16, 48x48, 128x128)
├── manifest.json       # Chrome Extension Manifest V3 configuration
├── package.json        # Build scripts and TypeScript/bundler devDependencies
├── tsconfig.json       # Strict TypeScript configuration
└── README.md
```

## Build Instructions

1. Install dependencies:
   ```bash
   npm install
   ```
2. Type-check and build the extension into `dist/`:
   ```bash
   npm run build
   ```

## Load in Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `KAtomation/dist` directory.
5. Pin **K{Atomation}** from the Extensions toolbar menu to open the popup, or click **Settings** in the popup to open the Profile Settings page.
