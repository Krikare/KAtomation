# `src/adapters/`

## Responsibility and Purpose

`src/adapters/` contains the platform-specific ATS detection and Milestone 4.1 Workday First Name autofill logic for **K{Atomation}**. Each recruitment platform adapter is self-contained and responsible for validating domains, distinguishing recruitment/application pages from general pages, extracting page signals, and (for Workday application pages only) filling the First Name field safely.

## Important Files

- **`baseAdapter.ts`**: Defines the `ATSAdapter` contract (`id`, `displayName`, `isSupportedUrl`, `detectFromUrl`, `detectFromDocument`, `getPageSignals`).
- **`workdayAdapter.ts`**: Implements `WorkdayAdapter` (`platformId: 'workday'`), `findWorkdayFirstNameField(doc)`, and `autofillWorkdayFirstName(doc, url, firstName)`.
- **`greenhouseAdapter.ts`**: Implements `GreenhouseAdapter` (`platformId: 'greenhouse'`).
- **`registry.ts`**: Registers all active adapters (`ATS_ADAPTERS`) and exposes `detectPlatformFromUrl(url)`, `detectPlatformInDocument(doc, url)`, and `createUnsupportedDetectionResult(url, reason)`.

## Main Logic and Implementation Details

- **Workday Detection (`WorkdayAdapter`)**:
  - Validates `http:`/`https:` URLs against `myworkdayjobs.com` (`WORKDAY_JOBS_HOST_PATTERN`) and `myworkday.com` (`WORKDAY_PORTAL_HOST_PATTERN`), rejecting unrelated domains containing `"workday"` (such as `notworkday.com` or `www.workday.com`).
  - Distinguishes `application` pages (`/apply` routes or `[data-automation-id="applyManually"]`, `[data-automation-id="workdayApplication"]`, `[data-automation-id^="formField-"]`, etc.) from `job_board` listings and generic `myworkday.com` `portal` pages.
- **Workday First Name Autofill (`findWorkdayFirstNameField`, `autofillWorkdayFirstName`)**:
  - Enforces `isSupportedUrl(url)` and `detectFromDocument(doc, url).isApplicationPage` before inspecting inputs.
  - Searches candidate inputs across three confidence tiers: (1) explicit Workday legal first name selectors (`[data-automation-id="legalNameSection_firstName"]`, `name="legalName--firstName"`, etc.), (2) explicit `firstName` / `autocomplete="given-name"` selectors, and (3) accessible label inspection (`label[for]`, wrapping `<label>`, `aria-label`, `aria-labelledby`, single-input `[data-automation-id^="formField-"]` label) matching `"First Name"`, `"Legal First Name"`, or `"Given Name"`.
  - Rejects disabled/readonly/hidden/non-text inputs and fields matching negative keywords (`last`, `middle`, `family`, `surname`, `preferred`, `emergency`, `email`, `phone`, etc.). Returns `field_ambiguous` if multiple unique candidates match at the active tier, `field_not_found` if none match, and `already_populated` if the input already contains a value.
  - Populates the matched input via the native `HTMLInputElement.prototype` value setter (when available) and dispatches bubbling `input` and `change` events so React/Workday state updates cleanly.
- **Greenhouse Detection (`GreenhouseAdapter`)**:
  - Validates `http:`/`https:` URLs against `boards`, `job-boards`, and `my` Greenhouse subdomains (including regional subdomains such as `boards.eu-central.greenhouse.io` and `eu.boards.greenhouse.io`), while rejecting marketing/admin hosts (`www.greenhouse.io`, `app.greenhouse.io`), substring false positives (`example.com/greenhouse/jobs`), and lookalike domains.
  - Distinguishes `application` pages (`/apply` or `/application` routes, `#application_form` / `#application-form` hashes, classic `#application_form` / `job_application[...]` fields, modern `form#application-form` elements, and embedded Greenhouse `<form action>` / `<iframe src>` elements inspected via `querySelectorAll`) from `job_board` and `my.greenhouse.io` `portal` pages.
- **Centralized Registry (`registry.ts`)**: Iterates `ATS_ADAPTERS` in order, returning the first supported `PlatformDetectionResult` or a safe `unsupported` result (`platformId: 'unknown'`).

## Interactions with Other Modules

- Consumed by **`src/content/content.ts`** (`detectPlatformInDocument` and `autofillWorkdayFirstName`) for live DOM + URL inspection and First Name autofill execution.
- Consumed by **`src/background/background.ts`** (`detectPlatformFromUrl` and `createUnsupportedDetectionResult`) when falling back to URL inspection or handling restricted tabs.
- Tested directly by **`tests/detection.test.ts`** and **`tests/workdayFirstNameAutofill.test.ts`**.
