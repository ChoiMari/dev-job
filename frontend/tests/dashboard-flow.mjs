// Manual browser check against the built frontend with mocked session and dashboard responses.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.S16_FRONTEND_URL || 'http://127.0.0.1:5186';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const counts = { INTERESTED: 0, PLANNED: 0, APPLIED: 0, DOCUMENT_PASSED: 0,
  INTERVIEW: 0, FINAL_PASSED: 0, REJECTED: 0, WITHDRAWN: 0 };
const empty = { applicationCounts: counts, bookmarkCount: 0, nextActions: [], recommendedJobs: [], skillGapPreview: [], personalTodos: [] };
let state = 'empty';
try {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 1, email: 's16@example.com' } }));
  await page.route('**/api/dashboard', route => {
    if (state === 'error') return route.fulfill({ status: 500, json: { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류' } });
    if (state === 'empty') return route.fulfill({ json: empty });
    return route.fulfill({ json: { ...empty, applicationCounts: { ...counts, PLANNED: 1 }, bookmarkCount: 2,
      nextActions: [{ applicationId: 9, jobId: 4, jobTitle: '백엔드 개발자', status: 'PLANNED', nextScheduleAt: null }],
      recommendedJobs: [{ id: 5, title: '서버 개발자', company: { id: 2, name: '회사' }, source: 'MOCK',
        location: null, careerRequirement: null, employmentType: null, deadlineDate: null,
        matchRate: 80, bookmarked: false, applicationStatus: null }],
      skillGapPreview: [{ id: 1, name: 'Docker' }] } });
  });
  await page.goto(base + '/#/');
  await page.getByText('예정된 다음 행동이 없습니다.').waitFor();
  assert.equal(await page.getByRole('heading', { name: '대시보드' }).count(), 1);
  state = 'ready';
  await page.reload();
  await page.getByText('지원 준비하기 · 백엔드 개발자').waitFor();
  assert.equal(await page.locator('a[href="#/jobs/5"]').count(), 1);
  assert.equal(await page.locator('a[href="#/applications/9"]').count(), 1);
  assert.equal(await page.locator('.dashboard-page a[href="#/learning-goals"]').count(), 2);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  state = 'error';
  await page.reload();
  await page.getByText('서버 오류').waitFor();
  state = 'ready';
  await page.getByRole('button', { name: '다시 시도' }).click();
  await page.getByText('Docker').waitFor();
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
