// Optional manual UI check against Vite with a contract-shaped in-browser API stub.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
let loggedIn = true;
let password = 'password123';
let mutations = 0;
page.on('pageerror', error => errors.push(error.message));

function json(body, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

await page.route('**/api/**', async route => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  if (!path.startsWith('/api/')) return route.continue();
  if (path === '/api/auth/csrf') return route.fulfill(json({ headerName: 'X-CSRF-TOKEN', token: 'test-token' }));
  if (path === '/api/auth/me') return route.fulfill(loggedIn
    ? json({ id: 1, email: 'b01@example.com' })
    : json({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' }, 401));
  if (path === '/api/auth/password') {
    mutations++;
    assert.equal(request.method(), 'PATCH');
    assert.equal(request.headers()['x-csrf-token'], 'test-token');
    assert.equal(request.headers().cookie, undefined);
    const body = request.postDataJSON();
    assert.deepEqual(Object.keys(body).sort(), ['currentPassword', 'newPassword']);
    if (body.currentPassword === 'server-bad')
      return route.fulfill(json({ code: 'INVALID_INPUT', message: '입력값을 확인해 주세요.' }, 400));
    if (body.currentPassword === 'csrf-bad')
      return route.fulfill(json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' }, 403));
    if (body.currentPassword !== password)
      return route.fulfill(json({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' }, 401));
    password = body.newPassword;
    loggedIn = false;
    return route.fulfill({ status: 204, body: '' });
  }
  if (path === '/api/auth/login') {
    const body = request.postDataJSON();
    if (body.password !== password)
      return route.fulfill(json({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' }, 401));
    loggedIn = true;
    return route.fulfill(json({ user: { id: 1, email: 'b01@example.com' } }));
  }
  return route.fulfill(json({ code: 'NOT_FOUND', message: '대상이 없습니다.' }, 404));
});

async function fill(current, next = 'replacement123') {
  await page.getByLabel('현재 비밀번호').fill(current);
  await page.getByLabel('새 비밀번호', { exact: true }).fill(next);
  await page.getByLabel('새 비밀번호 확인').fill(next);
  await page.getByRole('button', { name: '비밀번호 변경' }).click();
}

try {
  await page.goto('http://127.0.0.1:5177/#/settings');
  await page.getByRole('heading', { name: '비밀번호 변경' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await fill('password123', 'password123');
  await page.getByRole('alert').getByText(/현재 비밀번호와 달라야/).waitFor();
  assert.equal(mutations, 0);
  await fill('server-bad');
  await page.getByRole('alert').getByText(/입력값을 확인/).waitFor();
  await fill('csrf-bad');
  await page.getByRole('alert').getByText(/보안 확인에 실패/).waitFor();
  await fill('wrong-password');
  await page.getByRole('alert').getByText(/현재 비밀번호가 올바르지/).waitFor();
  assert.equal(new URL(page.url()).hash, '#/settings');
  await fill('password123');
  await page.getByText('비밀번호가 변경되었습니다.').waitFor();
  assert.equal(new URL(page.url()).hash, '#/login?passwordChanged=1');
  await page.getByLabel('이메일').fill('b01@example.com');
  await page.getByLabel('비밀번호', { exact: true }).fill('replacement123');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL('**/#/');
  await page.goto('http://127.0.0.1:5177/#/settings');
  await page.getByRole('heading', { name: '비밀번호 변경' }).waitFor();
  loggedIn = false;
  await fill('password123', 'next-password123');
  await page.getByText('로그인이 만료되었습니다. 다시 로그인해 주세요.').waitFor();
  assert.equal(new URL(page.url()).hash, '#/login?sessionExpired=1');
  assert.deepEqual(errors, []);
  console.log('B01 browser flow passed: 400/401/403, expired session, local validation, 204 logout, new-password login, 390px layout.');
} finally {
  await browser.close();
}
