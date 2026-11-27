import assert from 'node:assert/strict';
import test from 'node:test';
import {
  autofillWorkdayFirstName,
  findWorkdayFirstNameField,
} from '../src/adapters/workdayAdapter';
import { STORAGE_KEYS } from '../src/shared/constants';
import { getSavedFirstName } from '../src/storage/profileStorage';

interface MockInputOptions {
  id?: string;
  name?: string;
  type?: string;
  value?: string;
  disabled?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  attrs?: Record<string, string>;
  labelText?: string;
}

interface MockInputHandle {
  element: HTMLInputElement;
  events: Array<{ type: string; bubbles: boolean }>;
}

function createMockInput(opts: MockInputOptions = {}): MockInputHandle {
  const events: Array<{ type: string; bubbles: boolean }> = [];
  const attrs: Record<string, string> = { ...(opts.attrs ?? {}) };
  if (opts.type !== undefined) attrs.type = opts.type;

  const el = {
    tagName: 'INPUT',
    id: opts.id ?? '',
    name: opts.name ?? '',
    type: opts.type ?? 'text',
    value: opts.value ?? '',
    disabled: Boolean(opts.disabled),
    readOnly: Boolean(opts.readOnly),
    hidden: Boolean(opts.hidden),
    _labelText: opts.labelText ?? '',
    focusCalled: false,
    getAttribute(attrName: string) {
      return attrName in attrs ? attrs[attrName] : null;
    },
    closest() {
      return null;
    },
    focus() {
      el.focusCalled = true;
    },
    dispatchEvent(event: Event) {
      events.push({ type: event.type, bubbles: event.bubbles });
      return true;
    },
  };

  return {
    element: el as unknown as HTMLInputElement,
    events,
  };
}

function createMockWorkdayDoc(
  inputs: MockInputHandle[],
  extraSelectorMatches: string[] = ['[data-automation-id="workdayApplication"]'],
): Document {
  const matchesSelector = (el: HTMLInputElement, selector: string): boolean => {
    const rawEl = el as unknown as { getAttribute: (name: string) => string | null; id: string; name: string };
    if (selector === 'input') return true;
    if (selector === 'input[data-automation-id="legalNameSection_firstName"]') {
      return rawEl.getAttribute('data-automation-id') === 'legalNameSection_firstName';
    }
    if (selector === 'input[data-automation-id="firstName"]') {
      return rawEl.getAttribute('data-automation-id') === 'firstName';
    }
    if (selector === 'input[autocomplete="given-name"]') {
      return rawEl.getAttribute('autocomplete') === 'given-name';
    }
    if (selector === 'input[name="legalName--firstName"]') {
      return rawEl.name === 'legalName--firstName';
    }
    if (selector === 'input[id="legalName--firstName"]') {
      return rawEl.id === 'legalName--firstName';
    }
    if (selector === 'input[name="firstName"]') {
      return rawEl.name === 'firstName';
    }
    if (selector === 'input[id="firstName"]') {
      return rawEl.id === 'firstName';
    }
    if (selector === 'input[name="first_name"]') {
      return rawEl.name === 'first_name';
    }
    if (selector === 'input[id="first_name"]') {
      return rawEl.id === 'first_name';
    }
    return false;
  };

  return {
    querySelector(selector: string) {
      if (extraSelectorMatches.includes(selector)) {
        return { getAttribute: () => null } as unknown as Element;
      }

      const labelMatch = selector.match(/^label\[for="(.+)"\]$/);
      if (labelMatch?.[1]) {
        const targetId = labelMatch[1].replace(/\\(.)/g, '$1');
        const matched = inputs.find((item) => item.element.id === targetId);
        const labelText = (matched?.element as unknown as { _labelText?: string })?._labelText;
        if (labelText) {
          return { textContent: labelText } as unknown as Element;
        }
        return null;
      }

      const found = inputs.find((item) => matchesSelector(item.element, selector));
      return (found?.element as unknown as Element) ?? null;
    },
    querySelectorAll(selector: string) {
      return inputs
        .filter((item) => matchesSelector(item.element, selector))
        .map((item) => item.element as unknown as Element);
    },
  } as unknown as Document;
}

const WORKDAY_APPLY_URL = 'https://acme.wd1.myworkdayjobs.com/en-US/jobs/job/123/apply';

test('Workday First Name: identifies legalNameSection_firstName and fills with bubbling input/change events', () => {
  const searchBox = createMockInput({ id: 'search', name: 'q' });
  const lastNameInput = createMockInput({
    id: 'legalName--lastName',
    name: 'legalName--lastName',
    attrs: { 'data-automation-id': 'legalNameSection_lastName', autocomplete: 'family-name' },
    labelText: 'Last Name *',
  });
  const firstNameInput = createMockInput({
    id: 'legalName--firstName',
    name: 'legalName--firstName',
    attrs: { 'data-automation-id': 'legalNameSection_firstName', autocomplete: 'given-name' },
    labelText: 'First Name *',
  });

  const doc = createMockWorkdayDoc([searchBox, lastNameInput, firstNameInput]);
  const result = autofillWorkdayFirstName(doc, WORKDAY_APPLY_URL, '  Ada  ');

  assert.equal(result.ok, true);
  assert.equal(result.status, 'filled');
  assert.equal(result.message, 'First Name filled successfully.');
  assert.equal(firstNameInput.element.value, 'Ada');
  assert.equal(lastNameInput.element.value, '');
  assert.equal(searchBox.element.value, '');
  assert.deepEqual(firstNameInput.events, [
    { type: 'input', bubbles: true },
    { type: 'change', bubbles: true },
  ]);
});

test('Workday First Name: identifies dynamic input ID via associated label text', () => {
  const randomInput = createMockInput({ id: 'input-1', name: 'referralCode' });
  const dynamicFirstName = createMockInput({
    id: 'input-4',
    labelText: 'First Name *',
  });
  const dynamicLastName = createMockInput({
    id: 'input-5',
    labelText: 'Last Name *',
  });

  const doc = createMockWorkdayDoc([randomInput, dynamicFirstName, dynamicLastName]);
  const lookup = findWorkdayFirstNameField(doc);
  assert.equal(lookup.status, 'found');
  if (lookup.status === 'found') {
    assert.equal(lookup.element.id, 'input-4');
  }

  const result = autofillWorkdayFirstName(doc, WORKDAY_APPLY_URL, 'Grace');
  assert.equal(result.ok, true);
  assert.equal(dynamicFirstName.element.value, 'Grace');
  assert.equal(dynamicLastName.element.value, '');
});

test('Workday First Name: rejects unrelated, non-first-name, and ambiguous fields', () => {
  // Only Last Name and Preferred Name present -> must NOT guess or pick first input
  const genericInput = createMockInput({ id: 'input-1' });
  const preferredInput = createMockInput({
    id: 'preferred-first',
    attrs: { 'data-automation-id': 'preferredNameSection_firstName' },
    labelText: 'Preferred First Name',
  });
  const lastNameInput = createMockInput({
    id: 'last-name',
    name: 'lastName',
    labelText: 'Last Name',
  });

  const docNoFirst = createMockWorkdayDoc([genericInput, preferredInput, lastNameInput]);
  const notFound = autofillWorkdayFirstName(docNoFirst, WORKDAY_APPLY_URL, 'Ada');
  assert.equal(notFound.ok, false);
  assert.equal(notFound.status, 'field_not_found');
  assert.equal(genericInput.element.value, '');
  assert.equal(preferredInput.element.value, '');
  assert.equal(lastNameInput.element.value, '');

  // Multiple ambiguous First Name inputs -> must report ambiguous and fill neither
  const fn1 = createMockInput({ id: 'input-a', labelText: 'First Name' });
  const fn2 = createMockInput({ id: 'input-b', labelText: 'First Name' });
  const docAmbiguous = createMockWorkdayDoc([fn1, fn2]);
  const ambiguousResult = autofillWorkdayFirstName(docAmbiguous, WORKDAY_APPLY_URL, 'Ada');
  assert.equal(ambiguousResult.ok, false);
  assert.equal(ambiguousResult.status, 'field_ambiguous');
  assert.equal(fn1.element.value, '');
  assert.equal(fn2.element.value, '');
});

test('Workday First Name: does not overwrite an existing value', () => {
  const firstNameInput = createMockInput({
    id: 'legalName--firstName',
    value: 'ExistingName',
    attrs: { 'data-automation-id': 'legalNameSection_firstName' },
  });

  const doc = createMockWorkdayDoc([firstNameInput]);
  const result = autofillWorkdayFirstName(doc, WORKDAY_APPLY_URL, 'Ada');

  assert.equal(result.ok, false);
  assert.equal(result.status, 'already_populated');
  assert.equal(result.message, 'Field already contains a value.');
  assert.equal(firstNameInput.element.value, 'ExistingName');
  assert.equal(firstNameInput.events.length, 0);
});

test('Workday First Name: rejects empty First Name, unsupported ATS, and non-application pages', () => {
  const firstNameInput = createMockInput({
    id: 'legalName--firstName',
    attrs: { 'data-automation-id': 'legalNameSection_firstName' },
  });
  const doc = createMockWorkdayDoc([firstNameInput]);

  // Empty First Name
  const emptyName = autofillWorkdayFirstName(doc, WORKDAY_APPLY_URL, '   ');
  assert.equal(emptyName.ok, false);
  assert.equal(emptyName.status, 'missing_first_name');
  assert.equal(firstNameInput.element.value, '');

  // Unsupported ATS (Greenhouse application URL)
  const greenhouseBlocked = autofillWorkdayFirstName(
    doc,
    'https://boards.greenhouse.io/acme/jobs/123/apply',
    'Ada',
  );
  assert.equal(greenhouseBlocked.ok, false);
  assert.equal(greenhouseBlocked.status, 'unsupported_page');
  assert.equal(firstNameInput.element.value, '');

  // Non-application Workday page (careers listing with no application DOM/route)
  const careersDoc = createMockWorkdayDoc([firstNameInput], ['[data-automation-id="jobPostingPage"]']);
  const nonAppBlocked = autofillWorkdayFirstName(
    careersDoc,
    'https://acme.wd1.myworkdayjobs.com/en-US/careers',
    'Ada',
  );
  assert.equal(nonAppBlocked.ok, false);
  assert.equal(nonAppBlocked.status, 'unsupported_page');
  assert.equal(firstNameInput.element.value, '');
});

test('Storage getSavedFirstName: handles missing profile, empty First Name, valid First Name, and storage errors', async () => {
  const originalChrome = (globalThis as Record<string, unknown>).chrome;
  let storedData: Record<string, unknown> = {};
  let shouldThrow = false;

  (globalThis as Record<string, unknown>).chrome = {
    storage: {
      local: {
        async get(key: string) {
          if (shouldThrow) {
            throw new Error('storage unavailable');
          }
          return key in storedData ? { [key]: storedData[key] } : {};
        },
      },
    },
  };

  try {
    // 1. Missing profile
    storedData = {};
    const missing = await getSavedFirstName();
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.status, 'missing_profile');
    }

    // 2. Empty First Name
    storedData = {
      [STORAGE_KEYS.USER_PROFILE]: {
        personal: { firstName: '   ' },
      },
    };
    const empty = await getSavedFirstName();
    assert.equal(empty.ok, false);
    if (!empty.ok) {
      assert.equal(empty.status, 'missing_first_name');
    }

    // 3. Valid saved First Name
    storedData = {
      [STORAGE_KEYS.USER_PROFILE]: {
        personal: { firstName: '  Karthik  ' },
      },
    };
    const valid = await getSavedFirstName();
    assert.deepEqual(valid, { ok: true, firstName: 'Karthik' });

    // 4. Storage error
    shouldThrow = true;
    const errRes = await getSavedFirstName();
    assert.equal(errRes.ok, false);
    if (!errRes.ok) {
      assert.equal(errRes.status, 'storage_error');
    }
  } finally {
    if (originalChrome === undefined) {
      delete (globalThis as Record<string, unknown>).chrome;
    } else {
      (globalThis as Record<string, unknown>).chrome = originalChrome;
    }
  }
});
