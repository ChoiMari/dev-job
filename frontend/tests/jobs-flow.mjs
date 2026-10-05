// Manual integration check: run against a seeded disposable S08 DB and Vite proxy.
// Uses an existing Playwright installation; no production/test dependency is added.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.S08_FRONTEND_URL || 'http://127.0.0.1:5177';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await mkdir('.cache/s08', { recursive: true });
try {
  const email = `s08-${Date.now()}@example.com`;
  const token = async () => (await (await page.request.get(`${base}/api/auth/csrf`)).json()).token;
  let csrf = await token();
  let response = await page.request.post(`${base}/api/auth/register`, {
    data: { email, password: 'password123' }, headers: { 'X-CSRF-TOKEN': csrf },
  });
  assert.equal(response.status(), 201);
  csrf = await token();
  response = await page.request.post(`${base}/api/auth/login`, {
    data: { email, password: 'password123' }, headers: { 'X-CSRF-TOKEN': csrf },
  });
  assert.equal(response.status(), 200);

  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/jobs?**', async route => {
    const result = await route.fetch(); await gate; await route.fulfill({ response: result });
  });
  await page.goto(`${base}/#/jobs`);
  await page.getByText('저장된 공고를 검색하고 있습니다.').waitFor();
  release();
  await page.getByText('총 23건 · 1페이지').waitFor();
  await page.unroute('**/api/jobs?**');
  assert.equal(await page.locator('.job-card').count(), 20);
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await page.getByText('총 23건 · 2페이지').waitFor();
  assert.equal(await page.locator('.job-card').count(), 3);
  await page.locator('.job-card h2 a').first().click();
  await page.getByRole('heading', { name: '채용공고 원문' }).waitFor();
  await page.getByRole('link', { name: '← 채용공고 목록' }).click();
  await page.getByText('총 23건 · 2페이지').waitFor();

  await page.getByLabel('검색어 (제목·회사)').fill('Alpha');
  await page.getByLabel('지역', { exact: true }).fill('서울');
  await page.getByLabel('경력 조건').fill('신입');
  await page.getByLabel('고용 형태').fill('정규직');
  await page.getByLabel('마감일 이전').fill('2026-11-01');
  await page.getByLabel('정렬').selectOption('deadline');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.getByText('총 1건 · 1페이지').waitFor();
  const detailUrl = await page.locator('.job-card h2 a').getAttribute('href');
  await page.locator('.job-card h2 a').click();
  await page.getByRole('heading', { name: '채용공고 원문' }).waitFor();
  assert.equal(await page.locator('.job-description').textContent(), 'Java\n<script>window.s08Injected=true</script>');
  assert.equal(await page.evaluate(() => window.s08Injected), undefined);
  assert.equal(await page.getByRole('link', { name: '외부 원문 보기 (새 창)' }).getAttribute('href'), 'https://example.com/s08/1');
  await page.screenshot({ path: '.cache/s08/detail-desktop.png', fullPage: true });
  await page.reload();
  await page.getByRole('heading', { name: '채용공고 원문' }).waitFor();
  await page.getByRole('link', { name: '← 채용공고 목록' }).click();
  await page.getByText('총 1건 · 1페이지').waitFor();
  assert.equal(await page.getByLabel('지역', { exact: true }).inputValue(), '서울');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: '.cache/s08/list-mobile.png', fullPage: true });
  await page.goto(`${base}/${detailUrl}`);
  await page.getByRole('heading', { name: '채용공고 원문' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: '.cache/s08/detail-mobile.png', fullPage: true });
  await page.goto(`${base}/#/jobs?q=no-such-job`);
  await page.getByRole('heading', { name: '검색 결과가 없습니다.' }).waitFor();
  await page.goto(`${base}/#/jobs?page=99`);
  await page.getByRole('button', { name: '첫 페이지로' }).click();
  await page.getByText('총 23건 · 1페이지').waitFor();
  await page.goto(`${base}/#/jobs/999999999`);
  await page.getByRole('heading', { name: '공고를 찾을 수 없습니다.' }).waitFor();
  await page.goto(`${base}/#/jobs/0`);
  await page.getByText('공고 주소를 확인해 주세요.').waitFor();
  await page.route('**/api/jobs?**', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL_SERVER_ERROR', message: '검증용 오류' }) }));
  await page.goto(`${base}/#/jobs`);
  await page.getByText('검증용 오류').waitFor();
  await page.unroute('**/api/jobs?**');
  await page.getByRole('button', { name: '다시 시도' }).click();
  await page.getByText('총 23건 · 1페이지').waitFor();
  await page.route('**/api/jobs/*', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL_SERVER_ERROR', message: '상세 검증용 오류' }) }));
  await page.goto(`${base}/${detailUrl}`);
  await page.getByText('상세 검증용 오류').waitFor();
  await page.unroute('**/api/jobs/*');
  await page.getByRole('button', { name: '다시 시도' }).click();
  await page.getByRole('heading', { name: '채용공고 원문' }).waitFor();
  csrf = await token();
  assert.equal((await page.request.post(`${base}/api/auth/logout`, { headers: { 'X-CSRF-TOKEN': csrf } })).status(), 204);
  await page.goto(`${base}/#/jobs`);
  await page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: real session, search, combined filters, paging, list/detail/back/reload, raw text, empty/404/invalid ID, loading, list/detail retry, mobile overflow, logout protection; no page errors.');
} catch (error) {
  console.error('Browser errors:', errors, 'Page:', await page.locator('body').innerText());
  await page.screenshot({ path: '.cache/s08/failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); }
