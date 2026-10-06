// Manual screen check against a built frontend with mocked session and analytics responses.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.S14_FRONTEND_URL || 'http://127.0.0.1:5178';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let fail = false;
try {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 1, email: 's14@example.com' } }));
  await page.route('**/api/analytics/skills**', route => {
    if (fail) return route.fulfill({ status: 500, json: { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류' } });
    const query = new URL(route.request().url()).searchParams;
    const selected = query.get('desiredRole') === '백엔드';
    const second = query.get('page') === '1';
    return route.fulfill({ json: selected
      ? { items: second ? [{ skill: { id: 2, name: 'Docker' }, jobCount: 1, analyzedJobCount: 4, ratio: 0.25 }]
        : [{ skill: { id: 1, name: 'Java' }, jobCount: 2, analyzedJobCount: 4, ratio: 0.5 }],
        page: second ? 1 : 0, size: 1, totalElements: 2, analyzedJobCount: 4 }
      : { items: [], page: 0, size: 20, totalElements: 0, analyzedJobCount: 0 } });
  });
  await page.goto(`${base}/#/analytics/skills`);
  await page.getByText('조건에 맞는 분석 결과가 없습니다.').waitFor();
  await page.getByLabel('직무명').fill('백엔드');
  await page.getByRole('button', { name: '수요 조회' }).click();
  await page.getByText('분석 공고 4건 · 기술 2개').waitFor();
  assert.match(await page.locator('.market-list').innerText(), /Java.*2 \/ 4건.*50.0%/s);
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await page.getByText('2페이지').waitFor();
  assert.match(await page.locator('.market-list').innerText(), /Docker.*1 \/ 4건.*25.0%/s);
  fail = true;
  await page.getByRole('button', { name: '이전 페이지' }).click();
  await page.getByText('서버 오류').waitFor();
  fail = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await page.getByText('Java').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
