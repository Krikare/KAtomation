import assert from 'node:assert/strict';
import test from 'node:test';
import { GreenhouseAdapter } from '../src/adapters/greenhouseAdapter';
import {
  detectPlatformFromUrl,
  detectPlatformInDocument,
} from '../src/adapters/registry';
import { WorkdayAdapter } from '../src/adapters/workdayAdapter';

function createMockDocument(matchingSelectors: string[] = []): Document {
  return {
    querySelector(selector: string) {
      if (matchingSelectors.includes(selector)) {
        return {
          getAttribute: () => null,
        } as unknown as Element;
      }
      return null;
    },
  } as unknown as Document;
}

test('WorkdayAdapter: detects supported Workday domains and distinguishes page types', () => {
  const careers = detectPlatformFromUrl('https://acme.wd1.myworkdayjobs.com/en-US/careers');
  assert.equal(careers.platformId, 'workday');
  assert.equal(careers.platformName, 'Workday');
  assert.equal(careers.isSupported, true);
  assert.equal(careers.isApplicationPage, false);
  assert.equal(careers.pageType, 'job_board');

  const jobDetail = detectPlatformFromUrl('https://acme.wd5.myworkdayjobs.com/en-US/jobs/job/123');
  assert.equal(jobDetail.platformId, 'workday');
  assert.equal(jobDetail.isSupported, true);
  assert.equal(jobDetail.isApplicationPage, false);
  assert.equal(jobDetail.pageType, 'job_board');

  const applyRoute = detectPlatformFromUrl(
    'https://acme.wd5.myworkdayjobs.com/en-US/jobs/job/123/apply',
  );
  assert.equal(applyRoute.platformId, 'workday');
  assert.equal(applyRoute.isSupported, true);
  assert.equal(applyRoute.isApplicationPage, true);
  assert.equal(applyRoute.pageType, 'application');

  const portal = detectPlatformFromUrl('https://acme.myworkday.com/');
  assert.equal(portal.platformId, 'workday');
  assert.equal(portal.isSupported, true);
  assert.equal(portal.isApplicationPage, false);
  assert.equal(portal.pageType, 'portal');

  const portalApply = detectPlatformFromUrl('https://acme.myworkday.com/acme/d/task/123/apply');
  assert.equal(portalApply.platformId, 'workday');
  assert.equal(portalApply.isSupported, true);
  assert.equal(portalApply.isApplicationPage, true);
  assert.equal(portalApply.pageType, 'application');
});

test('WorkdayAdapter: rejects unrelated domains containing "workday"', () => {
  const notWorkday = detectPlatformFromUrl('https://notworkday.com/careers');
  assert.equal(notWorkday.platformId, 'unknown');
  assert.equal(notWorkday.isSupported, false);
  assert.equal(notWorkday.isApplicationPage, false);
  assert.equal(notWorkday.pageType, 'unsupported');

  const marketing = detectPlatformFromUrl('https://www.workday.com/en-us/homepage.html');
  assert.equal(marketing.platformId, 'unknown');
  assert.equal(marketing.isSupported, false);
});

test('GreenhouseAdapter: detects supported Greenhouse domains and distinguishes boards vs applications', () => {
  const board = detectPlatformFromUrl('https://boards.greenhouse.io/acme');
  assert.equal(board.platformId, 'greenhouse');
  assert.equal(board.platformName, 'Greenhouse');
  assert.equal(board.isSupported, true);
  assert.equal(board.isApplicationPage, false);
  assert.equal(board.pageType, 'job_board');

  const jobPost = detectPlatformFromUrl('https://job-boards.greenhouse.io/acme/jobs/123');
  assert.equal(jobPost.platformId, 'greenhouse');
  assert.equal(jobPost.isSupported, true);
  assert.equal(jobPost.isApplicationPage, false);
  assert.equal(jobPost.pageType, 'job_board');

  const applyPage = detectPlatformFromUrl('https://boards.greenhouse.io/acme/jobs/123/apply');
  assert.equal(applyPage.platformId, 'greenhouse');
  assert.equal(applyPage.isSupported, true);
  assert.equal(applyPage.isApplicationPage, true);
  assert.equal(applyPage.pageType, 'application');

  const euBoard = detectPlatformFromUrl('https://job-boards.eu.greenhouse.io/acme/jobs/456/apply');
  assert.equal(euBoard.platformId, 'greenhouse');
  assert.equal(euBoard.isSupported, true);
  assert.equal(euBoard.isApplicationPage, true);
  assert.equal(euBoard.pageType, 'application');
});

test('GreenhouseAdapter: rejects substring false positives on unrelated domains', () => {
  const falsePositive = detectPlatformFromUrl('https://example.com/greenhouse/jobs');
  assert.equal(falsePositive.platformId, 'unknown');
  assert.equal(falsePositive.isSupported, false);
  assert.equal(falsePositive.isApplicationPage, false);
  assert.equal(falsePositive.pageType, 'unsupported');

  const marketing = detectPlatformFromUrl('https://www.greenhouse.io/');
  assert.equal(marketing.platformId, 'unknown');
  assert.equal(marketing.isSupported, false);
});

test('Security & edge cases: rejects malicious lookalikes, malformed URLs, non-HTTP schemes, and empty input', () => {
  const cases = [
    '',
    '   ',
    'not-a-valid-url',
    'javascript:alert(1)',
    'file:///tmp/boards.greenhouse.io/acme/apply',
    'chrome://extensions',
    'https://www.google.com/search?q=workday+greenhouse',
    'https://myworkdayjobs.com.evil.com/en-US/careers',
    'https://evil-myworkdayjobs.com/en-US/apply',
    'https://boards.greenhouse.io.evil.com/acme/jobs/123/apply',
    'https://fakegreenhouse.io/acme/jobs/123',
    'https://greenhouse.io.phishing.org/acme',
  ];

  for (const url of cases) {
    const result = detectPlatformFromUrl(url);
    assert.equal(result.platformId, 'unknown', `Expected unknown for ${url}`);
    assert.equal(result.isSupported, false, `Expected isSupported=false for ${url}`);
    assert.equal(result.isApplicationPage, false, `Expected isApplicationPage=false for ${url}`);
    assert.equal(result.pageType, 'unsupported', `Expected unsupported pageType for ${url}`);
  }
});

test('Document detection: upgrades job pages to application pages when DOM application signals are present', () => {
  const workdayDoc = createMockDocument(['[data-automation-id="applyManually"]']);
  const wdResult = detectPlatformInDocument(
    workdayDoc,
    'https://acme.wd5.myworkdayjobs.com/en-US/jobs/job/123',
  );
  assert.equal(wdResult.platformId, 'workday');
  assert.equal(wdResult.isSupported, true);
  assert.equal(wdResult.isApplicationPage, true);
  assert.equal(wdResult.pageType, 'application');

  const greenhouseDoc = createMockDocument(['form#application_form']);
  const ghResult = detectPlatformInDocument(
    greenhouseDoc,
    'https://job-boards.greenhouse.io/acme/jobs/123',
  );
  assert.equal(ghResult.platformId, 'greenhouse');
  assert.equal(ghResult.isSupported, true);
  assert.equal(ghResult.isApplicationPage, true);
  assert.equal(ghResult.pageType, 'application');

  const emptyDoc = createMockDocument([]);
  const unrelatedResult = detectPlatformInDocument(emptyDoc, 'https://example.com/careers');
  assert.equal(unrelatedResult.platformId, 'unknown');
  assert.equal(unrelatedResult.isSupported, false);
});

test('Adapter isSupportedUrl validates subdomain variations cleanly', () => {
  const workday = new WorkdayAdapter();
  const greenhouse = new GreenhouseAdapter();

  assert.equal(workday.isSupportedUrl('https://sub.acme.wd12.myworkdayjobs.com/en-US/careers'), true);
  assert.equal(workday.isSupportedUrl('https://acme.myworkday.com/'), true);
  assert.equal(workday.isSupportedUrl('https://notmyworkday.com/'), false);

  assert.equal(greenhouse.isSupportedUrl('https://boards.greenhouse.io/acme'), true);
  assert.equal(greenhouse.isSupportedUrl('https://job-boards.eu.greenhouse.io/acme'), true);
  assert.equal(greenhouse.isSupportedUrl('https://app.greenhouse.io/dashboard'), false);
});
