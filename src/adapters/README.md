# `src/adapters/`

## Responsibility and Purpose

`src/adapters/` contains the platform-specific ATS detection and Milestone 4.2 Workday autofill logic (First Name, Last Name, and Email) for **K{Atomation}**. Each recruitment platform adapter is self-contained and responsible for validating domains, distinguishing recruitment/application pages from general pages, extracting page signals, and safely populating supported fields on Workday application pages.

## Important Files

- **`baseAdapter.ts`**: Defines the `ATSAdapter` contract (`id`, `displayName`, `isSupportedUrl`, `detectFromUrl`, `detectFromDocument`, `getPageSignals`).
- **`autofillUtils.ts`**: Shared, reusable field-resolution and DOM-population utilities (`getAccessibleLabel`, `isEligibleInputCandidate`, `findUniqueInputField`, `setInputValueAndDispatchEvents`, `populateMatchedField`).
- **`workdayAdapter.ts`**: Implements `WorkdayAdapter` (`platformId: 'workday'`), field configs for First Name, Last Name, and Email, lookup helpers (`findWorkdayFirstNameField`, `findWorkdayLastNameField`, `findWorkdayEmailField`), and autofill entrypoints (`autofillWorkdayFirstName`, `autofillWorkdayLastName`, `autofillWorkdayEmail`, `autofillWorkdayFields`).
- **`greenhouseAdapter.ts`**: Implements `GreenhouseAdapter` (`platformId: 'greenhouse'`).
- **`registry.ts`**: Registers all active adapters (`ATS_ADAPTERS`) and exposes `detectPlatformFromUrl(url)`, `detectPlatformInDocument(doc, url)`, and `createUnsupportedDetectionResult(url, reason)`.

## Main Logic and Implementation Details

- **Reusable Autofill Utilities (`autofillUtils.ts`)**:
  - `isEligibleInputCandidate()` validates `<input>` tags, filters out disallowed types (`hidden`, `checkbox`, `radio`, `file`, `submit`, `button`, `reset`, `image`, `password`), enforces `allowedInputTypes`, rejects `disabled`, `readOnly`, `hidden`, and `aria-hidden="true"` inputs, checks conflicting `autocomplete` values, and applies per-field negative keyword patterns across `id`, `name`, `data-automation-id`, `aria-label`, and label text.
  - `findUniqueInputField()` evaluates Tier 1 selectors, Tier 2 selectors, and Tier 3 accessible label matching (`aria-label`, `aria-labelledby`, `label[for]`, wrapping `<label>`, single-input `[data-automation-id^="formField-"]`), rejecting ambiguous multi-match candidates (`field_ambiguous`) and missing fields (`field_not_found`).
  - `populateMatchedField()` skips missing profile values, refuses to overwrite non-empty inputs (`already_populated`), writes values via the native `HTMLInputElement.prototype` setter when available, and dispatches bubbling `input` and `change` events.
- **Workday Detection & Basic Fields (`WorkdayAdapter`)**:
  - **First Name**: Matches `legalNameSection_firstName`, `legalName--firstName`, `firstName`, `autocomplete="given-name"`, and `"First Name"` / `"Given Name"` labels while rejecting `last`, `middle`, `preferred`, `emergency`, etc.
  - **Last Name**: Matches `legalNameSection_lastName`, `legalName--lastName`, `lastName`, `surname`, `autocomplete="family-name"`, and `"Last Name"` / `"Family Name"` / `"Surname"` labels while rejecting `first`, `middle`, `given`, `preferred`, `emergency`, `reference`, etc.
  - **Email**: Matches Workday primary email attributes (`data-automation-id="email"`, `contactInformation_email`, `name="email"`, `emailAddress`, `primaryEmail`), `autocomplete="email"`, `input[type="email"]`, and `"Email"` / `"Email Address"` labels while rejecting `secondary`, `alternate`, `backup`, `confirm`, `emergency`, `reference`, `work email`, `company email`, and street/mailing addresses.
  - `autofillWorkdayFields()` verifies `isSupportedUrl(url)` and `isApplicationPage`, then attempts First Name, Last Name, and Email independently and returns per-field results.
- **Greenhouse Detection (`GreenhouseAdapter`)**:
  - Validates `http:`/`https:` URLs against `boards`, `job-boards`, and `my` Greenhouse subdomains (including regional subdomains such as `boards.eu-central.greenhouse.io` and `eu.boards.greenhouse.io`), while rejecting marketing/admin hosts (`www.greenhouse.io`, `app.greenhouse.io`), substring false positives (`example.com/greenhouse/jobs`), and lookalike domains.
  - Distinguishes `application` pages (`/apply` or `/application` routes, `#application_form` / `#application-form` hashes, classic `#application_form` / `job_application[...]` fields, modern `form#application-form` elements, and embedded Greenhouse `<form action>` / `<iframe src>` elements inspected via `querySelectorAll`) from `job_board` and `my.greenhouse.io` `portal` pages.
- **Centralized Registry (`registry.ts`)**: Iterates `ATS_ADAPTERS` in order, returning the first supported `PlatformDetectionResult` or a safe `unsupported` result (`platformId: 'unknown'`).

## Interactions with Other Modules

- Consumed by **`src/content/content.ts`** (`detectPlatformInDocument`, `autofillWorkdayFirstName`, and `autofillWorkdayFields`) for live DOM + URL inspection and Workday autofill execution.
- Consumed by **`src/background/background.ts`** (`detectPlatformFromUrl` and `createUnsupportedDetectionResult`) when falling back to URL inspection or handling restricted tabs.
- Tested directly by **`tests/detection.test.ts`**, **`tests/workdayFirstNameAutofill.test.ts`**, and **`tests/workdayFieldsAutofill.test.ts`**.
