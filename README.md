# K{Atomation}

**K{Atomation}** is a Chrome Extension-only (Manifest V3) Universal Job Application Autofill tool written in TypeScript. Its goal is to recognize supported recruitment platforms (Workday and Greenhouse) and help populate repetitive application fields using locally stored user information, while leaving resume uploads and final application submission manual.

> **Current Development Status:** Milestone 4.2 (Workday First Name, Last Name & Email Autofill) is implemented. **Auto-fill** is enabled only on Workday application pages and independently attempts **First Name**, **Last Name**, and **Email**. Phone Number, Address, Education, Employment, Greenhouse autofill, resume upload automation, AI answering, and backend services are **not** implemented yet.

---

## Architecture Overview

K{Atomation} enforces strict separation of concerns across browser contexts and modules:

- **Shared Contracts ([src/shared/](file:///Users/karthikreddypeddala/Desktop/KAtomation/src/shared/README.md))**: Platform detection interfaces, autofill result/batch/message contracts, profile/answer schemas, storage keys, and default values with no browser-API coupling.
- **Local Persistence ([src/storage/](file:///Users/karthikreddypeddala/Desktop/KAtomation/src/storage/README.md))**: `chrome.storage.local` read/write/migration layer isolated from UI code and scoped per storage key, including `getSavedFirstName()` and `getWorkdayBasicProfileValues()`.
- **ATS Adapters & Autofill Utilities ([src/adapters/](file:///Users/karthikreddypeddala/Desktop/KAtomation/src/adapters/README.md))**: Independent Workday and Greenhouse detection adapters behind `ATSAdapter` and `registry.ts`, shared input matching and event dispatch helpers in `autofillUtils.ts`, and Workday First Name, Last Name, and Email autofill in `workdayAdapter.ts`.
- **Content Script ([src/content/](file:///Users/karthikreddypeddala/Desktop/KAtomation/src/content/README.md))**: Passive detection on Workday and Greenhouse pages (including debounced SPA navigation handling via `popstate`, `hashchange`, and `MutationObserver`) and `EXECUTE_WORKDAY_FIELDS_AUTOFILL` execution when triggered on Workday application pages.
- **Background Service Worker ([src/background/](file:///Users/karthikreddypeddala/Desktop/KAtomation/src/background/README.md))**: Seeds default storage on install, caches per-tab detections, handles restricted Chrome URLs safely, resolves active-tab platform status, and coordinates `AUTOFILL_WORKDAY_FIELDS` between storage, the popup, and the content script.
- **Popup UI ([src/popup/](file:///Users/karthikreddypeddala/Desktop/KAtomation/src/popup/README.md))**: Displays detected platform, page type, support status, and detection reason; enables **Auto-fill** only on Workday application pages and renders individual status rows for First Name, Last Name, and Email; keeps **Auto-fill** disabled on Greenhouse, non-application pages, and unsupported sites; and provides a **Settings** button.
- **Options UI ([src/options/](file:///Users/karthikreddypeddala/Desktop/KAtomation/src/options/README.md))**: Five-tab settings interface for Personal Info, repeatable Education and Employment records, Professional Links, and the Application Answer Library.

### Key Architectural Decisions

1. **Extension-Only Local Storage (`chrome.storage.local`)**: No backend server, database, authentication, or cloud sync is used. User profiles (`katomation_user_profile`) and application answers (`katomation_application_answers`) are stored under separate keys so updating or clearing one never wipes the other.
2. **Reusable, Safe Field Autofill (`autofillUtils.ts`)**: Shared utilities verify Workday application eligibility, evaluate Tier 1 Workday attributes, Tier 2 standard attributes, and Tier 3 accessible labels, reject disabled/readonly/hidden inputs and negative keyword matches (e.g., secondary/emergency/confirm emails or unrelated surname fields), reject ambiguous multi-match fields, skip non-empty values without overwriting, and dispatch bubbling `input` and `change` events using the native `HTMLInputElement.prototype` value setter when available.
3. **Independent Per-Field Execution & Reporting**: Missing or already-populated fields never block or mis-populate other fields, and the popup displays confirmed per-field outcomes only after the content script responds.
4. **No Invented Answers & Confirmation Flags**: The Application Answer Library starts empty and never fabricates answers. Legal/eligibility categories (`Work authorization`, `Visa sponsorship`) default `requiresConfirmation` to `true` for new answers.
5. **Lightweight Build & Test Tooling**: `esbuild` bundles TypeScript entrypoints into `dist/`, `tsc --noEmit` enforces strict type-checking, and Node's built-in `node:test` + `node:assert/strict` runs unit tests with zero external test framework dependencies.

---

## Project Structure

```text
KAtomation/
├── src/
│   ├── adapters/       # ATS adapters, registry, autofillUtils.ts, & Workday First/Last/Email autofill
│   ├── background/     # MV3 service worker (storage init, tab cache, autofill orchestration)
│   ├── content/        # Content script for ATS detection, SPA updates, & autofill execution
│   ├── options/        # Profile & Application Answer Engine settings page
│   ├── popup/          # Toolbar popup UI showing detection status & per-field Auto-fill feedback
│   ├── shared/         # Shared TypeScript interfaces, types, and constants
│   └── storage/        # chrome.storage.local persistence, profile lookups, & Milestone 1 migration
├── public/
│   └── icons/          # Extension icons (16x16, 48x48, 128x128)
├── tests/
│   ├── detection.test.ts               # Unit tests for ATS URL & mock-DOM detection
│   ├── workdayFirstNameAutofill.test.ts # Unit tests for Workday First Name autofill & storage
│   └── workdayFieldsAutofill.test.ts   # Unit tests for Last Name, Email, batch safety, & storage
├── dist/               # Built unpacked Chrome extension output (generated by build)
├── manifest.json       # Chrome Extension Manifest V3 configuration
├── package.json        # Scripts (typecheck, build, test) & devDependencies
├── tsconfig.json       # Strict TypeScript configuration
└── README.md
```

Each folder inside `src/` contains its own `README.md` documenting its files, internal logic, and interactions.

---

## Setup, Build, and Test Instructions

### Prerequisites

- Node.js (tested with Node `v24.12.0`) and npm
- Google Chrome (for loading the unpacked extension)

### 1. Install Dependencies

```bash
npm install
```

### 2. Type-Check & Build

```bash
npm run typecheck
npm run build
```

`npm run build` cleans `dist/`, runs `tsc --noEmit`, bundles `popup.ts`, `options.ts`, `background.ts`, and `content.ts` with `esbuild`, and copies `manifest.json`, `public/icons/`, HTML, and CSS assets into `dist/`.

### 3. Run Unit Tests

```bash
npm test
```

This bundles `tests/detection.test.ts`, `tests/workdayFirstNameAutofill.test.ts`, and `tests/workdayFieldsAutofill.test.ts` with `esbuild` and executes them with `node --test`, covering Workday and Greenhouse detection, malformed/non-HTTP URLs, lookalike domain rejection, First Name / Last Name / Email field identification, secondary/negative field rejection, ambiguity & non-overwrite guards, hidden/disabled/readonly rejection, bubbling `input`/`change` events, and storage edge cases.

### 4. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select `KAtomation/dist`.
4. After rebuilding `dist/`, click **Reload** on the **K{Atomation}** card in `chrome://extensions` and refresh any already-open recruitment tabs.

---

## Milestone History & Roadmap

### Completed Milestones

- **Milestone 1 — Extension Foundation**: Manifest V3 configuration, TypeScript + `esbuild` build pipeline, initial popup UI, basic profile options page, `chrome.storage.local` wrapper, and initial Workday/Greenhouse adapter stubs.
- **Milestone 2 — Universal Profile & Application Answer Engine**: Expanded `UserProfile` (`PersonalInfo`, repeatable `EducationRecord[]` and `EmploymentRecord[]` with `currentlyWorking`, `ProfessionalLinks`), added `ApplicationAnswer` library across 10 categories with confirmation flags, built the five-tab Options UI with accidental-deletion confirmations, and implemented backward-compatible storage migration.
- **Milestone 3 — Universal ATS Detection Engine**: Implemented `PlatformDetectionResult`, strict Workday and Greenhouse hostname + application-form detection, SPA-aware passive content script reporting, per-tab background caching with restricted-page safety, updated popup UI, `node:test` URL/DOM unit suite, and Greenhouse subdomain/modern-form detection fixes.
- **Milestone 4.1 — Workday First Name Autofill**: Implemented `getSavedFirstName()` lookup, Workday First Name field resolution and React/Workday-compatible `input`/`change` event dispatch, popup **Auto-fill** activation on Workday application pages, and unit tests. *(Manually verified on a live Workday application page.)*
- **Milestone 4.2 — Workday Last Name & Email Autofill**: Extracted reusable field matching/population helpers into `src/adapters/autofillUtils.ts`, added Workday Last Name and Email matching with negative keyword guards (excluding secondary/emergency/confirm emails and unrelated name fields), added `getWorkdayBasicProfileValues()`, implemented independent batch execution (`autofillWorkdayFields`) and per-field popup feedback rows, and added comprehensive unit tests in `tests/workdayFieldsAutofill.test.ts`.

### Pending Milestones (Not Yet Implemented)

- **Milestone 4.3+ (Planned)**: Additional Workday Personal Information fields (such as Phone Number and Address), Education/Employment/Links population, Greenhouse autofill, confirmation prompts for flagged Application Answer Library questions, and additional ATS adapters (such as Lever). Resume upload and final application submission will remain manual.
