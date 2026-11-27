# `src/shared/`

## Responsibility and Purpose

`src/shared/` holds the central TypeScript contracts and shared constants used across every part of the **K{Atomation}** Chrome extension. Centralizing these definitions keeps message payloads, storage schemas, and detection results consistent between the popup, options page, background service worker, content scripts, adapters, and storage layer.

## Important Files

- **`types.ts`**: Defines all shared domain models and Chrome runtime messaging types:
  - ATS detection types: `PlatformId`, `DetectedPageType`, `PlatformDetectionResult`.
  - Autofill result types: `AutofillStatusCode` (`filled`, `missing_profile`, `missing_first_name`, `field_not_found`, `field_ambiguous`, `already_populated`, `unsupported_page`, `storage_error`, `failed`) and `AutofillFieldResult`.
  - User profile types: `PersonalInfo`, `EducationRecord`, `EmploymentType`, `EmploymentRecord`, `ProfessionalLinks`, `WorkAuthorizationOption`, `SponsorshipOption`, and `UserProfile`.
  - Application Answer Library types: `AnswerCategory` (10 categories including `work_authorization`, `sponsorship`, `salary_expectations`, etc.) and `ApplicationAnswer`.
  - Extension messaging types: `ExtensionMessage` (`DETECT_PLATFORM`, `GET_PLATFORM_STATUS`, `PLATFORM_DETECTION_REPORT`, `AUTOFILL_WORKDAY_FIRST_NAME`, `EXECUTE_FIRST_NAME_AUTOFILL`) and `ExtensionMessageResponse`.
- **`constants.ts`**: Defines runtime constants and safe defaults:
  - `PRODUCT_NAME` (`'K{Atomation}'`).
  - `STORAGE_KEYS` (`USER_PROFILE` and `APPLICATION_ANSWERS`).
  - `DEFAULT_PERSONAL_INFO`, `DEFAULT_PROFESSIONAL_LINKS`, and `DEFAULT_USER_PROFILE`.
  - Human-readable label maps: `EMPLOYMENT_TYPE_LABELS` and `ANSWER_CATEGORY_LABELS`.
  - `INITIAL_DETECTION_STATE` (`Unknown` / `unsupported` fallback state).

## Implementation Details

- `src/shared/` contains zero Chrome API calls or DOM dependencies, so it can be safely imported in service worker, browser UI, content script, and Node unit-test environments alike.
- `UserProfile` separates `personal`, `education[]`, `employment[]`, and `links` while keeping `workAuthorized` and `sponsorshipRequired` for backward compatibility with Milestone 1 storage.

## Interactions with Other Modules

- Imported by **`src/adapters/`** for `PlatformDetectionResult` and `INITIAL_DETECTION_STATE`.
- Imported by **`src/storage/`** for `UserProfile`, `ApplicationAnswer`, `STORAGE_KEYS`, and default objects.
- Imported by **`src/background/`**, **`src/content/`**, **`src/popup/`**, and **`src/options/`** for typed runtime messaging and UI labels.
