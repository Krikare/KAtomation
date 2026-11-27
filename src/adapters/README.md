# `src/adapters/`

## Responsibility and Purpose

`src/adapters/` contains the platform-specific ATS detection logic for **K{Atomation}**. Each recruitment platform adapter is self-contained and responsible for validating domains, distinguishing recruitment/application pages from general pages, and extracting page signals—without performing any form filling or DOM mutation.

## Important Files

- **`baseAdapter.ts`**: Defines the `ATSAdapter` contract (`id`, `displayName`, `isSupportedUrl`, `detectFromUrl`, `detectFromDocument`, `getPageSignals`).
- **`workdayAdapter.ts`**: Implements `WorkdayAdapter` (`platformId: 'workday'`).
- **`greenhouseAdapter.ts`**: Implements `GreenhouseAdapter` (`platformId: 'greenhouse'`).
- **`registry.ts`**: Registers all active adapters (`ATS_ADAPTERS`) and exposes `detectPlatformFromUrl(url)`, `detectPlatformInDocument(doc, url)`, and `createUnsupportedDetectionResult(url, reason)`.

## Main Logic and Implementation Details

- **Workday Detection (`WorkdayAdapter`)**:
  - Validates `http:`/`https:` URLs against `myworkdayjobs.com` (`WORKDAY_JOBS_HOST_PATTERN`) and `myworkday.com` (`WORKDAY_PORTAL_HOST_PATTERN`), rejecting unrelated domains containing `"workday"` (such as `notworkday.com` or `www.workday.com`).
  - Distinguishes `application` pages (`/apply` routes or `[data-automation-id="applyManually"]`, `[data-automation-id="workdayApplication"]`, `[data-automation-id^="formField-"]`, etc.) from `job_board` listings and generic `myworkday.com` `portal` pages.
- **Greenhouse Detection (`GreenhouseAdapter`)**:
  - Validates `http:`/`https:` URLs against `boards`, `job-boards`, and `my` Greenhouse subdomains (including regional subdomains such as `boards.eu-central.greenhouse.io` and `eu.boards.greenhouse.io`), while rejecting marketing/admin hosts (`www.greenhouse.io`, `app.greenhouse.io`), substring false positives (`example.com/greenhouse/jobs`), and lookalike domains.
  - Distinguishes `application` pages (`/apply` or `/application` routes, `#application_form` / `#application-form` hashes, classic `#application_form` / `job_application[...]` fields, modern `form#application-form` elements, and embedded Greenhouse `<form action>` / `<iframe src>` elements inspected via `querySelectorAll`) from `job_board` and `my.greenhouse.io` `portal` pages.
- **Centralized Registry (`registry.ts`)**: Iterates `ATS_ADAPTERS` in order, returning the first supported `PlatformDetectionResult` or a safe `unsupported` result (`platformId: 'unknown'`).

## Interactions with Other Modules

- Consumed by **`src/content/content.ts`** (`detectPlatformInDocument`) for live DOM + URL inspection.
- Consumed by **`src/background/background.ts`** (`detectPlatformFromUrl` and `createUnsupportedDetectionResult`) when falling back to URL inspection or handling restricted tabs.
- Tested directly by **`tests/detection.test.ts`**.
