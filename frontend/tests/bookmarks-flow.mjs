// Manual integration check against the guarded S10 fixture, real Backend and Vite proxy.
// Reuses an installed Playwright; it is not a project dependency.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.S10_FRONTEND_URL || 'http://127.0.0.1:5181';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir('.cache/s10', { recursive: true });
async function mutate(request, method, path, data) {
  const csrf = await (await request.get(`${base}/api/auth/csrf`)).json();
  return request[method](`${base}/api${path}`, { data, headers: { 'X-CSRF-TOKEN': csrf.token } });
}
async function signIn(request, label) {
  const credentials = { email: `s10-${label}-${Date.now()}@example.com`, password: 'password123' };
  assert.equal((await mutate(request, 'post', '/auth/register', credentials)).status(), 201);
  assert.equal((await mutate(request, 'post', '/auth/login', credentials)).status(), 200);
}
try {
  await signIn(page.request, 'first');
  const jobs = (await (await page.request.get(`${base}/api/jobs?size=100`)).json()).items;
  assert.equal(jobs.length, 23);
  const id = jobs[0].id;
  await page.goto(`${base}/#/bookmarks`);
  await page.getByText('저장한 관심 공고가 없습니다.').waitFor();
  await page.getByRole('link', { name: '채용공고 찾아보기' }).click();
  const card = page.locator('.job-card').first();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let mutations = 0;
  await page.route('**/api/bookmarks', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    mutations++; const result = await route.fetch(); await gate; await route.fulfill({ response: result });
  });
  await card.getByRole('button', { name: '관심 공고 저장' }).click();
  await card.getByRole('button', { name: '처리 중…' }).waitFor();
  assert.equal(await card.getByRole('button').isDisabled(), true);
  release();
  await card.getByRole('button', { name: '저장 해제' }).waitFor();
  assert.equal(mutations, 1);
  await page.unroute('**/api/bookmarks');
  await card.locator('h2 a').click();
  await page.getByRole('button', { name: '저장 해제' }).waitFor();
  await page.reload(); await page.getByRole('button', { name: '저장 해제' }).waitFor();
  assert.equal(await page.evaluate(() => window.s10Injected), undefined);
  await page.getByRole('button', { name: '저장 해제' }).click();
  await page.getByRole('button', { name: '관심 공고 저장' }).waitFor();
  await page.route('**/api/bookmarks', route => route.fulfill({ status: 503, contentType: 'application/json',
    body: JSON.stringify({ code: 'SERVICE_UNAVAILABLE', message: '북마크 테스트 오류' }) }));
  await page.getByRole('button', { name: '관심 공고 저장' }).click();
  await page.getByRole('alert').filter({ hasText: '북마크 테스트 오류' }).waitFor();
  assert.equal(await page.getByRole('button', { name: '관심 공고 저장' }).getAttribute('aria-pressed'), 'false');
  await page.unroute('**/api/bookmarks');
  // A second tab could save first: stale add reconciles the real 409 with a fresh detail.
  assert.equal((await mutate(page.request, 'post', '/bookmarks', { jobId: id })).status(), 201);
  await page.getByRole('button', { name: '관심 공고 저장' }).click();
  await page.getByText('이미 저장된 공고입니다.').waitFor();
  assert.equal(await page.getByRole('button', { name: '저장 해제' }).getAttribute('aria-pressed'), 'true');
  assert.equal((await mutate(page.request, 'delete', `/bookmarks/${id}`)).status(), 204);
  await page.getByRole('button', { name: '저장 해제' }).click();
  await page.getByText('이미 해제된 공고입니다.').waitFor();
  await page.getByRole('button', { name: '관심 공고 저장' }).click();
  await page.getByRole('button', { name: '저장 해제' }).waitFor();
  // Seed the same user's remaining saved jobs through the real authenticated API.
  for (const job of jobs.slice(1)) assert.equal((await mutate(page.request, 'post', '/bookmarks', { jobId: job.id })).status(), 201);
  // An old detail's pending mutation must not change a newly opened job's state.
  let finishRemoval;
  const removalGate = new Promise(resolve => { finishRemoval = resolve; });
  await page.route(`**/api/bookmarks/${id}`, async route => {
    const result = await route.fetch(); await removalGate; await route.fulfill({ response: result });
  });
  await page.getByRole('button', { name: '저장 해제' }).click();
  await page.getByRole('button', { name: '처리 중…' }).waitFor();
  await page.goto(`${base}/#/jobs/${jobs[1].id}`);
  await page.getByRole('heading', { name: jobs[1].title, exact: true }).waitFor();
  await page.getByRole('button', { name: '저장 해제' }).waitFor();
  const removalResponse = page.waitForResponse(response => response.url().endsWith(`/api/bookmarks/${id}`) && response.request().method() === 'DELETE');
  finishRemoval(); await removalResponse;
  assert.equal(await page.getByRole('button', { name: '저장 해제' }).getAttribute('aria-pressed'), 'true');
  await page.unroute(`**/api/bookmarks/${id}`);
  assert.equal((await mutate(page.request, 'post', '/bookmarks', { jobId: id })).status(), 201);
  await page.goto(`${base}/#/bookmarks`);
  await page.getByText('총 23건 · 1페이지').waitFor();
  assert.equal(await page.locator('.job-card').count(), 20);
  await page.screenshot({ path: '.cache/s10/bookmarks-desktop.png' });
  const savedButton = page.locator('.job-card').first().getByRole('button', { name: '저장 해제' });
  await savedButton.hover();
  assert.deepEqual(await savedButton.evaluate(button => {
    const style = getComputedStyle(button); return [style.backgroundColor, style.color];
  }), ['rgb(34, 98, 73)', 'rgb(255, 255, 255)']);
  await page.screenshot({ path: '.cache/s10/bookmarks-desktop.png' });
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await page.getByText('총 23건 · 2페이지').waitFor();
  assert.equal(await page.locator('.job-card').count(), 3);
  await page.locator('.job-card h2 a').first().click();
  await page.getByRole('heading', { name: '채용공고 원문' }).waitFor();
  await page.getByRole('button', { name: '저장 해제' }).waitFor();
  await page.getByRole('link', { name: '← 관심 공고 목록' }).click();
  await page.getByText('총 23건 · 2페이지').waitFor();
  await page.goto(`${base}/#/bookmarks?page=22&size=1`);
  await page.getByText('총 23건 · 23페이지').waitFor();
  await page.getByRole('button', { name: '저장 해제' }).click();
  await page.getByText('총 22건 · 22페이지').waitFor();
  await page.goto(`${base}/#/bookmarks?page=100`);
  await page.getByText('이 페이지에 공고가 없습니다.').waitFor();
  await page.getByRole('button', { name: '첫 페이지로' }).click();
  await page.getByText('총 22건 · 1페이지').waitFor();
  await page.route('**/api/bookmarks?**', async route => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'TEST', message: '관심 공고 조회 테스트 오류' }) });
  });
  await page.reload();
  await page.getByText('관심 공고 조회 테스트 오류').waitFor();
  await page.unroute('**/api/bookmarks?**');
  await page.getByRole('button', { name: '다시 시도' }).click();
  await page.getByText('총 22건 · 1페이지').waitFor();
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('button:visible').evaluateAll(buttons => buttons.every(b => b.getBoundingClientRect().height >= 44)), true);
  }
  await page.screenshot({ path: '.cache/s10/bookmarks-mobile.png' });
  await page.locator('.job-card h2 a').first().click();
  await page.getByRole('heading', { name: '채용공고 원문' }).waitFor();
  await page.getByRole('button', { name: '저장 해제' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: '.cache/s10/detail-mobile.png', fullPage: true });
  const other = await browser.newContext();
  await signIn(other.request, 'second');
  const savedId = (await (await page.request.get(`${base}/api/bookmarks`)).json()).items[0].job.id;
  assert.equal((await (await page.request.get(`${base}/api/jobs/${savedId}`)).json()).bookmarked, true);
  assert.deepEqual((await (await other.request.get(`${base}/api/bookmarks`)).json()).items, []);
  assert.equal((await (await other.request.get(`${base}/api/jobs/${savedId}`)).json()).bookmarked, false);
  assert.equal((await mutate(other.request, 'delete', `/bookmarks/${savedId}`)).status(), 404);
  assert.equal((await (await page.request.get(`${base}/api/jobs/${savedId}`)).json()).bookmarked, true);
  const otherPage = await other.newPage();
  await otherPage.goto(`${base}/#/bookmarks`); await otherPage.getByText('저장한 관심 공고가 없습니다.').waitFor();
  await other.close();
  const remaining = (await (await page.request.get(`${base}/api/bookmarks?size=100`)).json()).items;
  for (const item of remaining.slice(1)) assert.equal((await mutate(page.request, 'delete', `/bookmarks/${item.job.id}`)).status(), 204);
  await page.goto(`${base}/#/bookmarks`);
  await page.getByText('총 1건 · 1페이지').waitFor();
  await page.getByRole('button', { name: '저장 해제' }).click();
  await page.getByText('저장한 관심 공고가 없습니다.').waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
  await page.goto(`${base}/#/bookmarks`);
  await page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('S10 real session flow, conflicts, owner isolation, paging, retry and responsive checks passed.');
} finally { await browser.close(); }
