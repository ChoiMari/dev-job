// Manual browser flow against a built frontend and mocked B03 responses.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.B03_FRONTEND_URL || 'http://127.0.0.1:5187';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const counts = { INTERESTED: 0, PLANNED: 0, APPLIED: 0, DOCUMENT_PASSED: 0,
  INTERVIEW: 0, FINAL_PASSED: 0, REJECTED: 0, WITHDRAWN: 0 };
const now = '2026-10-08T00:00:00Z';
let stored;
let csrfCount = 0;
let failList = false;
let failCompletion = false;
try {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 1, email: 'b03@example.com' } }));
  await page.route('**/api/auth/csrf', route => route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: `t${++csrfCount}` } }));
  await page.route('**/api/dashboard', route => route.fulfill({ json: {
    applicationCounts: counts, bookmarkCount: 0, nextActions: [], recommendedJobs: [], skillGapPreview: [],
    personalTodos: stored && !stored.completed ? [stored] : [],
  } }));
  await page.route('**/api/me/todos**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (method !== 'GET') assert.match(request.headers()['x-csrf-token'] || '', /^t\d+$/);
    if (url.pathname === '/api/me/todos' && method === 'GET') {
      if (failList) return route.fulfill({ status: 500, json: { code: 'INTERNAL_SERVER_ERROR', message: '잠시 후 다시 시도해 주세요.' } });
      const completed = url.searchParams.get('completed');
      const items = stored && (completed === null || String(stored.completed) === completed) ? [stored] : [];
      return route.fulfill({ json: { items, page: Number(url.searchParams.get('page')), size: 20, totalElements: items.length } });
    }
    if (url.pathname === '/api/me/todos' && method === 'POST') {
      const input = request.postDataJSON();
      assert.equal(input.title, '지원서 검토');
      assert.equal(input.dueAt, '2026-10-15T18:00:00+09:00');
      assert.equal(input.dueTimeZone, 'Asia/Seoul');
      stored = { id: 7, ...input, completed: false, completedAt: null, createdAt: now, updatedAt: now };
      return route.fulfill({ status: 201, json: stored });
    }
    if (url.pathname === '/api/me/todos/7' && method === 'GET') return route.fulfill({ json: stored });
    if (url.pathname === '/api/me/todos/7' && method === 'PATCH') {
      stored = { ...stored, ...request.postDataJSON() };
      return route.fulfill({ json: stored });
    }
    if (url.pathname === '/api/me/todos/7/completion' && method === 'PATCH') {
      if (failCompletion) return route.fulfill({ status: 500, json: { code: 'INTERNAL_SERVER_ERROR', message: '완료 처리에 실패했습니다.' } });
      const completed = request.postDataJSON().completed;
      stored = { ...stored, completed, completedAt: completed ? now : null };
      return route.fulfill({ json: stored });
    }
    if (url.pathname === '/api/me/todos/7' && method === 'DELETE') {
      stored = undefined; return route.fulfill({ status: 204, body: '' });
    }
    throw new Error(`Unexpected request ${method} ${url.pathname}`);
  });
  await page.goto(base + '/#/todos');
  await page.getByText('표시할 할 일이 없습니다.').waitFor();
  await page.getByRole('link', { name: '할 일 등록' }).click();
  await page.locator('.todos-form input[required]').fill('지원서 검토');
  await page.locator('.todos-form textarea').fill('오탈자 확인');
  await page.locator('.todos-form input[type="datetime-local"]').fill('2026-10-15T18:00');
  await page.getByRole('button', { name: '할 일 저장' }).click();
  await page.getByRole('heading', { name: '할 일 상세' }).waitFor();
  assert.equal(stored.title, '지원서 검토');
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.locator('.todos-form input[required]').fill('지원서 최종 검토');
  await page.getByRole('button', { name: '할 일 저장' }).click();
  await page.getByRole('heading', { name: '지원서 최종 검토' }).waitFor();
  failCompletion = true;
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await page.getByText('완료 처리에 실패했습니다.').waitFor();
  assert.equal(stored.completed, false);
  failCompletion = false;
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await page.getByText('할 일을 완료했습니다.').waitFor();
  await page.goto(base + '/#/');
  await page.getByRole('heading', { name: '지원에서 나온 다음 행동' }).waitFor();
  await page.getByRole('heading', { name: '내가 등록한 할 일' }).waitFor();
  await page.getByText('미완료 할 일이 없습니다.').waitFor();
  await page.goto(base + '/#/todos/7');
  await page.getByRole('button', { name: '완료 취소' }).click();
  await page.getByText('완료를 취소했습니다.').waitFor();
  await page.goto(base + '/#/');
  await page.locator('a[href="#/todos/7"]').waitFor();
  await page.goto(base + '/#/todos/7');
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await page.getByRole('button', { name: '삭제 취소' }).click();
  assert.ok(stored);
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await page.getByRole('button', { name: '삭제 확인' }).click();
  await page.getByText('표시할 할 일이 없습니다.').waitFor();
  assert.equal(stored, undefined);
  failList = true;
  await page.reload();
  await page.getByText('잠시 후 다시 시도해 주세요.').waitFor();
  failList = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await page.getByText('표시할 할 일이 없습니다.').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `${width}px overflow`);
  }
  assert.deepEqual(errors, []);
  console.log('B03 browser flow passed at 320px, 390px, 768px and 1440px');
} finally { await browser.close(); }
