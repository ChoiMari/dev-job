// Manual browser check against Vite proxy + a disposable S17 PostgreSQL backend.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.S17_FRONTEND_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.text().includes('Encountered two children with the same key')) errors.push(message.text());
});

async function visit(path, marker) {
  await page.goto(`${base}/#${path}`);
  await page.reload();
  await page.getByText(marker, { exact: false }).first().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${path} overflow`);
  await page.reload();
  await page.getByText(marker, { exact: false }).first().waitFor();
}

try {
  await page.goto(`${base}/#/profile`);
  await page.waitForURL('**/#/login');
  const email = `s17-browser-${Date.now()}@example.com`;
  const token = async () => (await (await context.request.get(`${base}/api/auth/csrf`)).json()).token;
  assert.equal((await context.request.post(`${base}/api/auth/register`, {
    data: { email, password: 'password123' }, headers: { 'X-CSRF-TOKEN': await token() },
  })).status(), 201);
  assert.equal((await context.request.post(`${base}/api/auth/login`, {
    data: { email, password: 'password123' }, headers: { 'X-CSRF-TOKEN': await token() },
  })).status(), 200);
  assert.equal((await context.request.put(`${base}/api/me/profile`, {
    data: { email, nickname: 'S17 Browser', desiredRole: 'S17 Backend' },
    headers: { 'X-CSRF-TOKEN': await token() },
  })).status(), 201);

  await visit('/', '다음 행동');
  await visit('/profile', '저장된 취업 정보를 수정할 수 있습니다.');
  assert.equal(await page.locator('input[name="name"]').inputValue(), 'S17 Browser');
  await visit('/projects', '등록한 프로젝트가 없습니다.');
  await visit('/jobs', 'S17 Backend 1');
  const first = (await (await context.request.get(`${base}/api/jobs?q=S17%20Backend`)).json()).items
    .find(job => job.title === 'S17 Backend 1');
  await visit(`/jobs/${first.id}`, '채용공고 원문');
  await visit('/bookmarks', '저장한 관심 공고가 없습니다.');
  await visit('/applications', '지원 기록이 없습니다.');
  await visit('/analytics/skills', '분석 공고 6건');
  await visit('/learning-goals', '역량 분석 요약');
  assert.deepEqual(errors, []);
  console.log('S17 browser flow passed: auth redirect, nine real backend screens, refresh and 390px layout.');
} finally {
  await browser.close();
}
