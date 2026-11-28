import assert from 'node:assert/strict';
import test from 'node:test';
import {
  autofillWorkdayEmail,
  autofillWorkdayFields,
  autofillWorkdayLastName,
  findWorkdayEmailField,
  findWorkdayLastNameField,
} from '../src/adapters/workdayAdapter';
import { STORAGE_KEYS } from '../src/shared/constants';
import { getWorkdayBasicProfileValues } from '../src/storage/profileStorage';

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
    getAttribute(attrName: string) {
      return attrName in attrs ? attrs[attrName] : null;
    },
    closest() {
      return null;
    },
    focus() {},
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
    const rawEl = el as unknown as {
      getAttribute: (name: string) => string | null;
      id: string;
      name: string;
      type: string;
    };
    if (selector === 'input') return true;
    const attrMatch = selector.match(/^input\[([a-zA-Z0-9-]+)="([^"]+)"\]$/);
    if (attrMatch?.[1] && attrMatch[2]) {
      const attrName = attrMatch[1];
      const expected = attrMatch[2];
      if (attrName === 'id') return rawEl.id === expected;
      if (attrName === 'name') return rawEl.name === expected;
      if (attrName === 'type') return (rawEl.getAttribute('type') ?? rawEl.type) === expected;
      return rawEl.getAttribute(attrName) === expected;
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

const WORKDAY_APPLY_URL = 'https://acme.wd5.myworkdayjobs.com/en-US/jobs/job/123/apply';

test('Last Name: identifies legalNameSection_lastName, ignores First Name, and fires bubbling input/change events', () => {
  const firstName = createMockInput({
    id: 'legalName--firstName',
    name: 'legalName--firstName',
    attrs: { 'data-automation-id': 'legalNameSection_firstName', autocomplete: 'given-name' },
    labelText: 'First Name *',
  });
  const lastName = createMockInput({
    id: 'legalName--lastName',
    name: 'legalName--lastName',
    attrs: { 'data-automation-id': 'legalNameSection_lastName', autocomplete: 'family-name' },
    labelText: 'Last Name *',
  });

  const doc = createMockWorkdayDoc([firstName, lastName]);
  const res = autofillWorkdayLastName(doc, WORKDAY_APPLY_URL, '  Lovelace  ');

  assert.equal(res.ok, true);
  assert.equal(res.status, 'filled');
  assert.equal(lastName.element.value, 'Lovelace');
  assert.equal(firstName.element.value, '');
  assert.deepEqual(lastName.events, [
    { type: 'input', bubbles: true },
    { type: 'change', bubbles: true },
  ]);
});

test('Last Name: rejects First Name / emergency contact / ambiguous candidates and skips existing value', () => {
  const onlyFirstName = createMockInput({
    id: 'firstName',
    name: 'firstName',
    attrs: { 'data-automation-id': 'legalNameSection_firstName', autocomplete: 'given-name' },
    labelText: 'First Name',
  });
  const emergencyLastName = createMockInput({
    id: 'emergencyLastName',
    name: 'emergencyLastName',
    labelText: 'Emergency Contact Last Name',
  });
  const docNoLast = createMockWorkdayDoc([onlyFirstName, emergencyLastName]);
  const notFound = autofillWorkdayLastName(docNoLast, WORKDAY_APPLY_URL, 'Lovelace');
  assert.equal(notFound.ok, false);
  assert.equal(notFound.status, 'field_not_found');
  assert.equal(onlyFirstName.element.value, '');
  assert.equal(emergencyLastName.element.value, '');

  // Ambiguous Last Name inputs
  const ln1 = createMockInput({ id: 'input-10', labelText: 'Last Name' });
  const ln2 = createMockInput({ id: 'input-11', labelText: 'Family Name' });
  const docAmbig = createMockWorkdayDoc([ln1, ln2]);
  const ambig = autofillWorkdayLastName(docAmbig, WORKDAY_APPLY_URL, 'Lovelace');
  assert.equal(ambig.ok, false);
  assert.equal(ambig.status, 'field_ambiguous');
  assert.equal(ln1.element.value, '');
  assert.equal(ln2.element.value, '');

  // Missing Last Name value
  const lnValid = createMockInput({ id: 'lastName', name: 'lastName', labelText: 'Last Name' });
  const docValid = createMockWorkdayDoc([lnValid]);
  const missing = autofillWorkdayLastName(docValid, WORKDAY_APPLY_URL, '   ');
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 'missing_value');

  // Existing Last Name value preserved
  lnValid.element.value = 'ExistingLast';
  const populated = autofillWorkdayLastName(docValid, WORKDAY_APPLY_URL, 'Lovelace');
  assert.equal(populated.ok, false);
  assert.equal(populated.status, 'already_populated');
  assert.equal(lnValid.element.value, 'ExistingLast');
});

test('Email: identifies primary email, rejects secondary/alternate/emergency emails and ambiguous fields', () => {
  const secondaryEmail = createMockInput({
    id: 'secondaryEmail',
    name: 'secondaryEmail',
    type: 'email',
    attrs: { autocomplete: 'email' },
    labelText: 'Secondary Email Address',
  });
  const emergencyEmail = createMockInput({
    id: 'emergencyEmail',
    name: 'emergencyEmail',
    type: 'email',
    labelText: 'Emergency Contact Email',
  });
  const primaryEmail = createMockInput({
    id: 'email',
    name: 'email',
    type: 'email',
    attrs: { 'data-automation-id': 'email', autocomplete: 'email' },
    labelText: 'Email Address *',
  });

  const doc = createMockWorkdayDoc([secondaryEmail, emergencyEmail, primaryEmail]);
  const lookup = findWorkdayEmailField(doc);
  assert.equal(lookup.status, 'found');
  if (lookup.status === 'found') {
    assert.equal(lookup.element.id, 'email');
  }

  const res = autofillWorkdayEmail(doc, WORKDAY_APPLY_URL, 'ada@analytical.org');
  assert.equal(res.ok, true);
  assert.equal(res.status, 'filled');
  assert.equal(primaryEmail.element.value, 'ada@analytical.org');
  assert.equal(secondaryEmail.element.value, '');
  assert.equal(emergencyEmail.element.value, '');
  assert.deepEqual(primaryEmail.events, [
    { type: 'input', bubbles: true },
    { type: 'change', bubbles: true },
  ]);

  // Ambiguous emails (two unlabelled email inputs)
  const e1 = createMockInput({ id: 'input-a', type: 'email' });
  const e2 = createMockInput({ id: 'input-b', type: 'email' });
  const docAmbig = createMockWorkdayDoc([e1, e2]);
  const ambig = autofillWorkdayEmail(docAmbig, WORKDAY_APPLY_URL, 'ada@analytical.org');
  assert.equal(ambig.ok, false);
  assert.equal(ambig.status, 'field_ambiguous');
  assert.equal(e1.element.value, '');
  assert.equal(e2.element.value, '');

  // Missing Email value & Existing Email preserved
  const singleEmailDoc = createMockWorkdayDoc([
    createMockInput({ id: 'email', type: 'email', value: '' }),
  ]);
  const missingEmail = autofillWorkdayEmail(singleEmailDoc, WORKDAY_APPLY_URL, '');
  assert.equal(missingEmail.ok, false);
  assert.equal(missingEmail.status, 'missing_value');

  const populatedEmailInput = createMockInput({
    id: 'email',
    type: 'email',
    value: 'keep@example.com',
  });
  const populatedDoc = createMockWorkdayDoc([populatedEmailInput]);
  const populated = autofillWorkdayEmail(populatedDoc, WORKDAY_APPLY_URL, 'ada@analytical.org');
  assert.equal(populated.ok, false);
  assert.equal(populated.status, 'already_populated');
  assert.equal(populatedEmailInput.element.value, 'keep@example.com');
});

test('Shared safety: rejects hidden, disabled, readonly inputs and handles dynamic label-matched fields', () => {
  const hiddenLast = createMockInput({
    id: 'lastName-hidden',
    name: 'lastName',
    hidden: true,
  });
  const disabledEmail = createMockInput({
    id: 'email-disabled',
    name: 'email',
    type: 'email',
    disabled: true,
  });
  const readonlyFirst = createMockInput({
    id: 'firstName-ro',
    name: 'firstName',
    readOnly: true,
  });
  const dynamicLast = createMockInput({
    id: 'input-dynamic-22',
    labelText: 'Last Name *',
  });
  const dynamicEmail = createMockInput({
    id: 'input-dynamic-23',
    type: 'email',
    labelText: 'Email Address',
  });

  const doc = createMockWorkdayDoc([
    hiddenLast,
    disabledEmail,
    readonlyFirst,
    dynamicLast,
    dynamicEmail,
  ]);

  const lookupLast = findWorkdayLastNameField(doc);
  assert.equal(lookupLast.status, 'found');
  if (lookupLast.status === 'found') {
    assert.equal(lookupLast.element.id, 'input-dynamic-22');
  }

  const batch = autofillWorkdayFields(doc, WORKDAY_APPLY_URL, {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@analytical.org',
  });

  assert.equal(batch.ok, true);
  assert.equal(batch.results.length, 3);
  assert.equal(batch.results[0]?.status, 'field_not_found'); // readonly First Name skipped
  assert.equal(batch.results[1]?.status, 'filled'); // dynamic Last Name filled
  assert.equal(batch.results[2]?.status, 'filled'); // dynamic Email filled
  assert.equal(readonlyFirst.element.value, '');
  assert.equal(hiddenLast.element.value, '');
  assert.equal(disabledEmail.element.value, '');
  assert.equal(dynamicLast.element.value, 'Lovelace');
  assert.equal(dynamicEmail.element.value, 'ada@analytical.org');
});

test('Batch autofill: independent per-field results and blocked on unsupported/non-application pages', () => {
  const firstName = createMockInput({
    id: 'legalName--firstName',
    value: 'AlreadyHere',
    attrs: { 'data-automation-id': 'legalNameSection_firstName' },
  });
  const lastName = createMockInput({
    id: 'legalName--lastName',
    attrs: { 'data-automation-id': 'legalNameSection_lastName' },
  });
  const email = createMockInput({
    id: 'email',
    type: 'email',
    attrs: { 'data-automation-id': 'email' },
  });

  const doc = createMockWorkdayDoc([firstName, lastName, email]);
  const batch = autofillWorkdayFields(doc, WORKDAY_APPLY_URL, {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: '',
  });

  assert.equal(batch.ok, true);
  assert.equal(batch.results[0]?.status, 'already_populated');
  assert.equal(batch.results[1]?.status, 'filled');
  assert.equal(batch.results[2]?.status, 'missing_value');
  assert.equal(firstName.element.value, 'AlreadyHere');
  assert.equal(lastName.element.value, 'Lovelace');
  assert.equal(email.element.value, '');

  // Unsupported Greenhouse URL
  const ghBlocked = autofillWorkdayFields(
    doc,
    'https://boards.greenhouse.io/acme/jobs/123/apply',
    { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@analytical.org' },
  );
  assert.equal(ghBlocked.ok, false);
  assert.ok(ghBlocked.results.every((r) => r.status === 'unsupported_page'));
});

test('Storage getWorkdayBasicProfileValues: reads First Name, Last Name, Email and handles missing/errors', async () => {
  const originalChrome = (globalThis as Record<string, unknown>).chrome;
  let storedData: Record<string, unknown> = {};
  let shouldThrow = false;

  (globalThis as Record<string, unknown>).chrome = {
    storage: {
      local: {
        async get(key: string) {
          if (shouldThrow) throw new Error('storage read failed');
          return key in storedData ? { [key]: storedData[key] } : {};
        },
      },
    },
  };

  try {
    storedData = {};
    const missing = await getWorkdayBasicProfileValues();
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.status, 'missing_profile');

    storedData = {
      [STORAGE_KEYS.USER_PROFILE]: {
        personal: {
          firstName: '  Ada ',
          lastName: ' Lovelace ',
          email: ' ada@analytical.org ',
        },
      },
    };
    const valid = await getWorkdayBasicProfileValues();
    assert.deepEqual(valid, {
      ok: true,
      values: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@analytical.org',
      },
    });

    shouldThrow = true;
    const errRes = await getWorkdayBasicProfileValues();
    assert.equal(errRes.ok, false);
    if (!errRes.ok) assert.equal(errRes.status, 'storage_error');
  } finally {
    if (originalChrome === undefined) {
      delete (globalThis as Record<string, unknown>).chrome;
    } else {
      (globalThis as Record<string, unknown>).chrome = originalChrome;
    }
  }
});
