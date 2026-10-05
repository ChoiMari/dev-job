// Run against a disposable S06 database and Vite proxy. Uses an existing Playwright installation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.S06_FRONTEND_URL || 'http://127.0.0.1:5176';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
await mkdir('.cache/s06', { recursive: true });
try {
  const email = `s06-${Date.now()}@example.com`;
  const csrf = async () => (await (await page.request.get(`${base}/api/auth/csrf`)).json()).token;
  const credentials = { email, password: 'S06-test-password' };
  assert.equal((await page.request.post(`${base}/api/auth/register`, { headers: { 'X-CSRF-TOKEN': await csrf() }, data: credentials })).status(), 201);
  assert.equal((await page.request.post(`${base}/api/auth/login`, { headers: { 'X-CSRF-TOKEN': await csrf() }, data: credentials })).status(), 200);
  await page.goto(`${base}/#/projects`);
  await page.getByRole('heading', { name: '등록한 프로젝트가 없습니다.' }).waitFor();
  await page.getByRole('link', { name: '프로젝트 추가' }).click();
  await page.getByLabel('프로젝트명').fill('S06 CRM');
  await page.getByLabel('시작일').fill('2026-01-01');
  await page.getByLabel('역할', { exact: true }).fill('백엔드');
  await page.getByLabel('프로젝트 설명').fill('line1\n<script>window.s06Injected=true</script>');
  await page.getByLabel('프로젝트 URL').fill('https://example.com/s06');
  await page.getByLabel('기술명 또는 별칭').fill('Postgres');
  await page.getByRole('button', { name: '기술 검색', exact: true }).click();
  await page.getByRole('button', { name: 'PostgreSQL 선택', exact: true }).click();
  await page.screenshot({ path: '.cache/s06/form-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await page.getByRole('heading', { name: 'S06 CRM', exact: true }).waitFor();
  const detail = page.url();
  assert.equal(await page.evaluate(() => window.s06Injected), undefined);
  assert.equal(await page.getByRole('link', { name: '프로젝트 URL 보기 (새 창)' }).getAttribute('href'), 'https://example.com/s06');
  assert.deepEqual((await (await page.request.get(`${base}/api/me/skills`)).json()).items, []);
  await page.reload(); await page.getByRole('heading', { name: 'S06 CRM', exact: true }).waitFor();
  await page.getByRole('button', { name: '프로젝트 수정', exact: true }).click();
  await page.getByLabel('프로젝트명').fill('S06 Updated');
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await page.getByRole('heading', { name: '프로젝트를 저장했습니다.' }).waitFor();
  await page.reload(); await page.getByRole('heading', { name: 'S06 Updated', exact: true }).waitFor();
  await page.getByRole('button', { name: '프로젝트 수정', exact: true }).click();
  await page.getByRole('button', { name: 'PostgreSQL 선택 해제' }).click();
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await page.getByText('등록한 기술 없음', { exact: true }).waitFor();
  await page.getByRole('link', { name: '← 프로젝트 목록' }).click();
  await page.getByRole('link', { name: 'S06 Updated', exact: true }).waitFor();
  await page.screenshot({ path: '.cache/s06/list-desktop.png', fullPage: true });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.goto(detail); await page.getByRole('heading', { name: 'S06 Updated', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole('button', { name: '프로젝트 수정', exact: true }).click();
    await page.getByRole('button', { name: '기술 검색', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(await page.locator('button, input, .button-link').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height < 44).map(element => element.textContent)), []);
    await page.screenshot({ path: `.cache/s06/form-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: '수정 취소' }).click();
    await page.getByRole('link', { name: '← 프로젝트 목록' }).click();
    await page.getByRole('link', { name: 'S06 Updated', exact: true }).waitFor();
  }
  // Failed saves preserve the form; retry and detail loading use the real backend after interception ends.
  await page.goto(detail); await page.getByRole('button', { name: '프로젝트 수정', exact: true }).click();
  await page.getByLabel('프로젝트명').fill('S06 Retried');
  await page.route('**/api/me/projects/*', route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL_SERVER_ERROR', message: '저장 검증 오류' }) }) : route.continue());
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await page.getByText('저장 검증 오류').waitFor();
  assert.equal(await page.getByLabel('프로젝트명').inputValue(), 'S06 Retried');
  await page.unroute('**/api/me/projects/*');
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await page.getByRole('heading', { name: 'S06 Retried', exact: true }).waitFor();
  await page.route('**/api/me/projects/*', async route => { await new Promise(resolve => setTimeout(resolve, 300)); await route.continue(); });
  await page.reload(); await page.getByText('프로젝트를 불러오고 있습니다.').waitFor();
  await page.getByRole('heading', { name: 'S06 Retried', exact: true }).waitFor(); await page.unroute('**/api/me/projects/*');
  await page.route('**/api/me/projects?**', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL_SERVER_ERROR', message: '목록 검증 오류' }) }));
  await page.goto(`${base}/#/projects`); await page.getByText('목록 검증 오류').waitFor();
  await page.unroute('**/api/me/projects?**'); await page.getByRole('button', { name: '다시 시도' }).click();
  await page.getByRole('link', { name: 'S06 Retried', exact: true }).click();
  await page.getByRole('button', { name: '프로젝트 삭제', exact: true }).click();
  await page.getByRole('button', { name: '삭제 취소', exact: true }).click();
  await page.getByRole('heading', { name: 'S06 Retried', exact: true }).waitFor();
  await page.getByRole('button', { name: '프로젝트 삭제', exact: true }).click();
  await page.getByRole('button', { name: '삭제 확인', exact: true }).click();
  await page.getByRole('heading', { name: '등록한 프로젝트가 없습니다.' }).waitFor();
  await page.goto(detail); await page.getByRole('heading', { name: '프로젝트를 찾을 수 없습니다.' }).waitFor();
  await page.goto(`${base}/#/projects/0`); await page.getByRole('heading', { name: '프로젝트 주소를 확인해 주세요.' }).waitFor();
  for (let index = 0; index < 21; index++) {
    assert.equal((await page.request.post(`${base}/api/me/projects`, { headers: { 'X-CSRF-TOKEN': await csrf() },
      data: { name: `Paging ${index}`, startDate: '2026-01-01', skillIds: [] } })).status(), 201);
  }
  await page.goto(`${base}/#/projects`); await page.getByText('총 21건 · 1페이지').waitFor();
  assert.equal(await page.locator('.project-list > li').count(), 20);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByText('총 21건 · 2페이지').waitFor(); assert.equal(await page.locator('.project-list > li').count(), 1);
  await page.getByRole('button', { name: '이전', exact: true }).click(); await page.getByText('총 21건 · 1페이지').waitFor();
  await page.route('**/api/me/projects?**', route => route.request().url().includes('page=1')
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL_SERVER_ERROR', message: '페이지 검증 오류' }) }) : route.continue());
  await page.getByRole('button', { name: '다음', exact: true }).click(); await page.getByText('페이지 검증 오류').waitFor();
  await page.unroute('**/api/me/projects?**'); await page.getByRole('button', { name: '다시 시도' }).click();
  await page.getByText('총 21건 · 2페이지').waitFor(); assert.equal(await page.locator('.project-list > li').count(), 1);
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
  await page.goto(`${base}/#/projects`); await page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: real session, empty/list/detail/create/update/delete/reload, 20+1 paging, retained and removed skill links, UserSkill independence, safe text/link, loading, save failure preserves form, list retry, delete cancel, 404/invalid route, 768/390/320px overflow and 44px targets, logout protection; no page errors.');
} finally { await browser.close(); }
