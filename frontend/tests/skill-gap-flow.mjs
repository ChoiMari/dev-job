// Manual browser check against the built frontend with mocked session and Skill Gap responses.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.S15_FRONTEND_URL || 'http://127.0.0.1:5178';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let state = 'insufficient';
const item = (id, name, required, preferred) => ({ skill: { id, name },
  requiredJobCount: required, preferredJobCount: preferred, demandJobCount: required + preferred,
  demandRatio: (required + preferred) / 20, priorityScore: 100 * (required + 0.5 * preferred) / 20 });
try {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 1, email: 's15@example.com' } }));
  await page.route('**/api/me/skill-gap**', route => {
    if (state === 'error') return route.fulfill({ status: 500, json: { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류' } });
    if (state === 'insufficient') return route.fulfill({ json: { available: false, desiredRole: '백엔드',
      analyzedJobCount: 4, provisional: false, totalMissingSkills: 0, items: [], reason: 'INSUFFICIENT_SAMPLE' } });
    const count = state === 'provisional' ? 10 : 20;
    const items = state === 'provisional' ? [{ skill: { id: 2, name: 'Docker' },
      requiredJobCount: 4, preferredJobCount: 2, demandJobCount: 6, demandRatio: 0.6, priorityScore: 50 }]
      : [item(1, 'Spring Boot', 16, 2), item(2, 'Docker', 10, 3)];
    return route.fulfill({ json: { available: true, desiredRole: '백엔드', analyzedJobCount: count,
      provisional: count < 20, totalMissingSkills: items.length, items, reason: null } });
  });
  await page.goto(`${base}/#/skill-gap?desiredRole=백엔드`);
  await page.getByText('분석 공고가 부족합니다.').waitFor();
  state = 'provisional';
  await page.getByRole('button', { name: '순위 보기' }).click();
  await page.getByText('표본 적음', { exact: false }).waitFor();
  assert.match(await page.locator('.skill-gap-list').innerText(), /1위.*Docker.*등장률 60%.*필수 4건 \/ 우대 2건/s);
  state = 'ready';
  await page.getByRole('button', { name: '순위 보기' }).click();
  await page.getByText('분석 완료 공고 20건').waitFor();
  assert.equal(await page.getByText('표본 적음', { exact: false }).count(), 0);
  assert.match(await page.locator('.skill-gap-list').innerText(), /1위.*Spring Boot.*등장률 90%.*필수 16건 \/ 우대 2건.*2위.*Docker/s);
  assert.equal(await page.getByText(/점수|HIGH|MEDIUM|LOW/).count(), 0);
  state = 'error';
  await page.getByRole('button', { name: '순위 보기' }).click();
  await page.getByText('서버 오류').waitFor();
  state = 'ready';
  await page.getByRole('button', { name: '다시 시도' }).click();
  await page.getByText('Spring Boot').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
