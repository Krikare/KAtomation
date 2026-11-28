import type { AutofillFieldKey, AutofillFieldResult } from '../shared/types';

export type FieldLookupResult =
  | { status: 'found'; element: HTMLInputElement; matchedBy: string }
  | { status: 'ambiguous' | 'not_found'; reason: string };

export interface FieldMatcherConfig {
  field: AutofillFieldKey;
  fieldLabel: string;
  tier1Selectors: readonly string[];
  tier2Selectors: readonly string[];
  exactLabelPattern: RegExp;
  negativePattern: RegExp;
  disallowedAutocomplete: ReadonlySet<string>;
  allowedInputTypes?: ReadonlySet<string>;
}

const DISALLOWED_INPUT_TYPES = new Set([
  'hidden',
  'checkbox',
  'radio',
  'file',
  'submit',
  'button',
  'reset',
  'image',
  'password',
]);

const DEFAULT_ALLOWED_INPUT_TYPES = new Set(['', 'text']);

export function escapeSelectorAttr(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

export function normalizeLabelText(raw: string): string {
  return raw
    .replace(/\*/g, ' ')
    .replace(/\(required\)|\brequired\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function queryElements(root: Document, selector: string): Element[] {
  if (typeof root.querySelectorAll === 'function') {
    return Array.from(root.querySelectorAll(selector));
  }
  const single = root.querySelector(selector);
  return single ? [single] : [];
}

/**
 * Resolves accessible label text for a form input using ARIA attributes,
 * explicit <label for>, wrapping <label>, or single-input Workday formField wrappers.
 */
export function getAccessibleLabel(doc: Document, input: HTMLInputElement): string {
  const ariaLabel = input.getAttribute?.('aria-label');
  if (ariaLabel && ariaLabel.trim()) {
    return ariaLabel.trim();
  }

  const labelledBy = input.getAttribute?.('aria-labelledby');
  if (labelledBy && labelledBy.trim()) {
    const parts = labelledBy
      .trim()
      .split(/\s+/)
      .map((id) => doc.querySelector(`#${escapeSelectorAttr(id)}`)?.textContent?.trim() ?? '')
      .filter((text) => text.length > 0);
    if (parts.length > 0) {
      return parts.join(' ');
    }
  }

  if (input.id) {
    const explicitLabel = doc.querySelector(`label[for="${escapeSelectorAttr(input.id)}"]`);
    if (explicitLabel?.textContent?.trim()) {
      return explicitLabel.textContent.trim();
    }
  }

  const wrappingLabel = typeof input.closest === 'function' ? input.closest('label') : null;
  if (wrappingLabel?.textContent?.trim()) {
    return wrappingLabel.textContent.trim();
  }

  const fieldWrapper =
    typeof input.closest === 'function'
      ? input.closest('[data-automation-id^="formField-"]')
      : null;
  if (fieldWrapper && typeof fieldWrapper.querySelectorAll === 'function') {
    const nestedInputs = fieldWrapper.querySelectorAll('input');
    if (nestedInputs.length === 1) {
      const formLabel =
        fieldWrapper.querySelector('[data-automation-id="formLabel"]') ??
        fieldWrapper.querySelector('label');
      if (formLabel?.textContent?.trim()) {
        return formLabel.textContent.trim();
      }
    }
  }

  return '';
}

/**
 * Validates whether a DOM element is an eligible, non-excluded <input> candidate
 * for the target field configuration.
 */
export function isEligibleInputCandidate(
  doc: Document,
  candidate: Element,
  config: FieldMatcherConfig,
): candidate is HTMLInputElement {
  const input = candidate as HTMLInputElement;
  if (input.tagName && input.tagName.toUpperCase() !== 'INPUT') {
    return false;
  }

  const rawType = (input.getAttribute?.('type') ?? input.type ?? 'text').toLowerCase();
  if (DISALLOWED_INPUT_TYPES.has(rawType)) {
    return false;
  }

  const allowedTypes = config.allowedInputTypes ?? DEFAULT_ALLOWED_INPUT_TYPES;
  if (!allowedTypes.has(rawType)) {
    return false;
  }

  if (
    input.disabled ||
    input.readOnly ||
    input.hidden ||
    input.getAttribute?.('aria-hidden') === 'true'
  ) {
    return false;
  }

  const autocomplete = (input.getAttribute?.('autocomplete') ?? '').trim().toLowerCase();
  if (autocomplete && config.disallowedAutocomplete.has(autocomplete)) {
    return false;
  }

  const labelText = getAccessibleLabel(doc, input);
  const metadataToInspect = [
    input.id ?? '',
    input.name ?? '',
    input.getAttribute?.('data-automation-id') ?? '',
    input.getAttribute?.('aria-label') ?? '',
    labelText,
  ].join(' ');

  if (config.negativePattern.test(metadataToInspect)) {
    return false;
  }

  return true;
}

function collectTierMatches(
  doc: Document,
  selectors: readonly string[],
  config: FieldMatcherConfig,
): { elements: HTMLInputElement[]; matchedSelector: string } {
  const unique = new Set<HTMLInputElement>();
  let matchedSelector = '';

  for (const selector of selectors) {
    for (const el of queryElements(doc, selector)) {
      if (isEligibleInputCandidate(doc, el, config)) {
        if (!matchedSelector) {
          matchedSelector = selector;
        }
        unique.add(el);
      }
    }
  }

  return { elements: Array.from(unique), matchedSelector };
}

/**
 * Resolves a single unambiguous input element across tiered Workday/HTML selectors
 * and accessible label matching, returning ambiguous/not_found when uncertain.
 */
export function findUniqueInputField(
  doc: Document,
  config: FieldMatcherConfig,
): FieldLookupResult {
  const tier1 = collectTierMatches(doc, config.tier1Selectors, config);
  if (tier1.elements.length === 1 && tier1.elements[0]) {
    return { status: 'found', element: tier1.elements[0], matchedBy: tier1.matchedSelector };
  }
  if (tier1.elements.length > 1) {
    return {
      status: 'ambiguous',
      reason: `Multiple ${config.fieldLabel} fields detected; unable to determine a unique target.`,
    };
  }

  const tier2 = collectTierMatches(doc, config.tier2Selectors, config);
  if (tier2.elements.length === 1 && tier2.elements[0]) {
    return { status: 'found', element: tier2.elements[0], matchedBy: tier2.matchedSelector };
  }
  if (tier2.elements.length > 1) {
    return {
      status: 'ambiguous',
      reason: `Multiple ${config.fieldLabel} fields detected; unable to determine a unique target.`,
    };
  }

  const labelMatches = new Set<HTMLInputElement>();
  for (const el of queryElements(doc, 'input')) {
    if (!isEligibleInputCandidate(doc, el, config)) {
      continue;
    }
    const normalizedLabel = normalizeLabelText(getAccessibleLabel(doc, el));
    if (normalizedLabel && config.exactLabelPattern.test(normalizedLabel)) {
      labelMatches.add(el);
    }
  }

  const resolved = Array.from(labelMatches);
  if (resolved.length === 1 && resolved[0]) {
    return { status: 'found', element: resolved[0], matchedBy: `label:${config.field}` };
  }
  if (resolved.length > 1) {
    return {
      status: 'ambiguous',
      reason: `Multiple ${config.fieldLabel} fields detected; unable to determine a unique target.`,
    };
  }

  return {
    status: 'not_found',
    reason: `${config.fieldLabel} field could not be identified.`,
  };
}

/**
 * Sets an input value using the native HTMLInputElement prototype setter when available
 * (so React controlled inputs detect the update) and dispatches bubbling input and change events.
 */
export function setInputValueAndDispatchEvents(input: HTMLInputElement, value: string): void {
  if (typeof input.focus === 'function') {
    input.focus();
  }

  const prototypeSetter =
    typeof HTMLInputElement !== 'undefined' && input instanceof HTMLInputElement
      ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      : undefined;

  if (prototypeSetter) {
    prototypeSetter.call(input, value);
  } else {
    input.value = value;
  }

  if (typeof input.dispatchEvent === 'function' && typeof Event === 'function') {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Safely populates a matched field if non-empty in profile and not already populated on the page.
 */
export function populateMatchedField(
  doc: Document,
  rawValue: string,
  config: FieldMatcherConfig,
  emptyStatus: 'missing_first_name' | 'missing_value' = 'missing_value',
): AutofillFieldResult {
  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return {
      ok: false,
      status: emptyStatus,
      field: config.field,
      label: config.fieldLabel,
      message: `${config.fieldLabel} is missing from your profile.`,
    };
  }

  const lookup = findUniqueInputField(doc, config);
  if (lookup.status !== 'found') {
    return {
      ok: false,
      status: lookup.status === 'ambiguous' ? 'field_ambiguous' : 'field_not_found',
      field: config.field,
      label: config.fieldLabel,
      message: lookup.reason,
    };
  }

  const currentValue = (lookup.element.value ?? '').trim();
  if (currentValue.length > 0) {
    return {
      ok: false,
      status: 'already_populated',
      field: config.field,
      label: config.fieldLabel,
      message: 'Field already contains a value.',
      matchedBy: lookup.matchedBy,
    };
  }

  try {
    setInputValueAndDispatchEvents(lookup.element, trimmedValue);
    return {
      ok: true,
      status: 'filled',
      field: config.field,
      label: config.fieldLabel,
      message: `${config.fieldLabel} filled successfully.`,
      matchedBy: lookup.matchedBy,
    };
  } catch {
    return {
      ok: false,
      status: 'failed',
      field: config.field,
      label: config.fieldLabel,
      message: 'Autofill failed.',
    };
  }
}
