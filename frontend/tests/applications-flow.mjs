// Integration check against s11-browser.sql in a disposable devjob_s11_test database.
// Reuses the bundled Playwright; adds no dependency to the application.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.S11_FRONTEND_URL || 'http://127.0.0.1:5182';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Seoul' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir('.cache/s11', { recursive: true });
const token = async () => (await (await page.request.get(base + '/api/auth/csrf')).json()).token;
async function mutation(path, data, method = 'post') {
  return page.request[method](base + '/api' + path, { data, headers: { 'X-CSRF-TOKEN': await token() } });
}
async function layout(name) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' overflow');
  const small = await page.locator('button, input, select, .button-link').evaluateAll(nodes => nodes
    .filter(node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0)
    .filter(node => node.getBoundingClientRect().height < 44).map(node => node.outerHTML));
  assert.deepEqual(small, [], name + ' touch targets');
  await page.screenshot({ path: '.cache/s11/' + name + '.png', fullPage: true });
}
try {
  const email = 's11-browser-' + Date.now() + '@example.com';
  assert.equal((await mutation('/auth/register', { email, password: 'password123' })).status(), 201);
  assert.equal((await mutation('/auth/login', { email, password: 'password123' })).status(), 200);
  const jobs = (await (await page.request.get(base + '/api/jobs?q=S11&size=100')).json()).items;
  assert.equal(jobs.length, 24);
  const target = jobs[0];

  await page.goto(base + '/#/applications');
  await page.getByRole('heading', { name: '지원 기록이 없습니다.' }).waitFor();

  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/applications?**', async route => { const result = await route.fetch(); await gate; await route.fulfill({ response: result }); });
  await page.reload();
  await page.getByText('지원 목록을 불러오고 있습니다.').waitFor();
  release(); await page.getByRole('heading', { name: '지원 기록이 없습니다.' }).waitFor();
  await page.unroute('**/api/applications?**');

  await page.goto(base + '/#/jobs/' + target.id);
  await page.getByRole('button', { name: '지원 등록하기' }).click();
  await page.getByLabel('메모', { exact: true }).fill('준비 메모');
  await page.getByLabel('다음 일정 (내 시간대)').fill('2026-10-10T14:00');
  await page.getByRole('button', { name: '지원 기록 저장' }).click();
  await page.getByRole('heading', { name: '내 지원 현황' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: '내 지원 현황' }).waitFor();
  await page.getByRole('link', { name: '지원 관리로' }).click();
  await page.getByRole('link', { name: '지원 상세', exact: true }).click();
  await page.getByRole('heading', { name: '상태 변경 이력' }).waitFor();
  await page.locator('.application-history li').first().waitFor();
  assert.equal(await page.locator('.application-history li').count(), 1);
  assert.equal(await page.getByLabel('다음 일정 (내 시간대)').inputValue(), '2026-10-10T14:00');
  const detailHash = new URL(page.url()).hash;
  const id = Number(detailHash.match(/applications\/(\d+)/)[1]);

  await page.getByLabel('메모', { exact: true }).fill('수정\n<script>window.s11Injected=true</script>');
  await page.getByRole('button', { name: '메모·일정 저장' }).click();
  await page.getByText('메모와 일정을 저장했습니다.').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.application-history li').length === 1);
  assert.equal(await page.locator('.application-history li').count(), 1);
  await page.getByLabel('지원일', { exact: true }).fill('2026-10-05');
  await page.getByRole('button', { name: '상태 변경 저장' }).click();
  await page.getByText('지원 상태를 변경했습니다.').waitFor();
  await page.getByText('지원일: 2026-10-05', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.application-history li').length === 2);

  await page.getByRole('link', { name: '공고 상세 보기' }).click();
  await page.getByRole('heading', { name: '내 지원 현황' }).waitFor();
  await page.getByRole('link', { name: '지원 관리로' }).click();
  await page.getByText('수정\n<script>window.s11Injected=true</script>', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.s11Injected), undefined);
  await page.getByLabel('지원 상태 필터').selectOption('APPLIED');
  await page.getByRole('link', { name: '지원 상세', exact: true }).click();
  await page.getByRole('link', { name: '← 지원 목록' }).click();
  assert.equal(await page.getByLabel('지원 상태 필터').inputValue(), 'APPLIED');

  await page.goto(base + '/#/jobs');
  await page.getByLabel('내 지원 상태').selectOption('APPLIED');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.getByText('총 1건 · 1페이지').waitFor();
  assert.equal(await page.locator('.job-card').count(), 1);

  await page.goto(base + '/' + detailHash);
  await page.getByLabel('메모', { exact: true }).waitFor();
  await page.route('**/api/applications/' + id, async route => {
    if (route.request().method() === 'PATCH') return route.fulfill({ status: 500, contentType: 'application/json',
      body: JSON.stringify({ code: 'INTERNAL_SERVER_ERROR', message: '저장 실패 테스트' }) });
    await route.continue();
  });
  await page.getByLabel('메모', { exact: true }).fill('실패 후에도 남아야 하는 초안');
  await page.getByRole('button', { name: '메모·일정 저장' }).click();
  await page.getByText('저장 실패 테스트', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('메모', { exact: true }).inputValue(), '실패 후에도 남아야 하는 초안');
  await page.unroute('**/api/applications/' + id);
  await page.getByRole('button', { name: '메모·일정 저장' }).click();
  await page.getByText('메모와 일정을 저장했습니다.').waitFor();

  await page.route('**/api/applications/' + id + '/history', route => route.fulfill({ status: 500, contentType: 'application/json',
    body: JSON.stringify({ code: 'INTERNAL_SERVER_ERROR', message: '이력 실패 테스트' }) }));
  await page.reload();
  await page.getByText('이력 실패 테스트', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('메모', { exact: true }).inputValue(), '실패 후에도 남아야 하는 초안');
  await page.unroute('**/api/applications/' + id + '/history');
  await page.getByRole('button', { name: '다시 시도' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.application-history li').length === 2);

  for (const next of ['DOCUMENT_PASSED', 'INTERVIEW', 'FINAL_PASSED']) {
    await page.getByLabel('다음 상태').selectOption(next);
    const response = page.waitForResponse(r => r.url().endsWith('/applications/' + id + '/status') && r.request().method() === 'PATCH');
    await page.getByRole('button', { name: '상태 변경 저장' }).click();
    assert.equal((await response).status(), 200);
  }
  await page.getByText('종료된 지원 기록입니다.').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.application-history li').length === 5);

  for (let index = 1; index < jobs.length; index++) {
    assert.equal((await mutation('/applications', { jobId: jobs[index].id, status: index % 2 ? 'INTERESTED' : 'PLANNED' })).status(), 201);
  }
  await page.goto(base + '/#/applications');
  await page.getByText('총 24건 · 1페이지 · 현재 페이지 20건').waitFor();
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await page.getByText('총 24건 · 2페이지 · 현재 페이지 4건').waitFor();
  await page.reload(); await page.getByText('총 24건 · 2페이지 · 현재 페이지 4건').waitFor();
  await page.getByLabel('지원 상태 필터').selectOption('REJECTED');
  await page.getByRole('heading', { name: '지원 기록이 없습니다.' }).waitFor();

  await page.goto(base + '/#/applications');
  await page.getByText('총 24건 · 1페이지 · 현재 페이지 20건').waitFor();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await layout('board-' + width);
    await page.goto(base + '/' + detailHash);
    await page.getByText('종료된 지원 기록입니다.').waitFor();
    await layout('detail-' + width);
    await page.goto(base + '/#/jobs/' + jobs[1].id);
    await page.getByRole('heading', { name: '내 지원 현황' }).waitFor();
    await layout('job-' + width);
    await page.goto(base + '/#/applications');
    await page.getByText('총 24건 · 1페이지 · 현재 페이지 20건').waitFor();
  }
  assert.equal(await page.evaluate(() => window.s11Injected), undefined);
  await page.goto(base + '/#/applications/9223372036854775807');
  await page.getByText('지원 주소를 확인해 주세요.', { exact: true }).waitFor();
  await page.goto(base + '/#/applications/9999999');
  await page.getByRole('heading', { name: '지원 기록을 찾을 수 없습니다.' }).waitFor();

  const otherContext = await browser.newContext({ viewport: { width: 320, height: 812 }, timezoneId: 'Asia/Seoul' });
  const other = await otherContext.newPage();
  other.on('pageerror', error => errors.push(error.message));
  const otherToken = async () => (await (await other.request.get(base + '/api/auth/csrf')).json()).token;
  const otherEmail = 's11-other-' + Date.now() + '@example.com';
  for (const action of ['register', 'login']) {
    const result = await other.request.post(base + '/api/auth/' + action, { data: { email: otherEmail, password: 'password123' }, headers: { 'X-CSRF-TOKEN': await otherToken() } });
    assert.equal(result.status(), action === 'register' ? 201 : 200);
  }
  await other.goto(base + '/#/applications/' + id);
  await other.getByText('접근 권한이 없습니다.', { exact: true }).waitFor();
  await other.goto(base + '/#/jobs/' + target.id);
  await other.getByRole('button', { name: '지원 등록하기' }).click();
  await other.getByLabel('초기 상태').selectOption('APPLIED');
  await other.getByLabel('지원일', { exact: true }).fill('2026-10-06');
  await other.getByLabel('다음 일정 (내 시간대)').fill('2026-10-11T09:30');
  await other.getByLabel('메모', { exact: true }).fill('직접 지원 완료 등록');
  assert.equal(await other.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await other.screenshot({ path: '.cache/s11/registration-320.png', fullPage: true });
  await other.getByRole('button', { name: '지원 기록 저장' }).click();
  await other.getByRole('heading', { name: '내 지원 현황' }).waitFor();
  await other.getByRole('link', { name: '지원 관리로' }).click();
  await other.getByText('총 1건 · 1페이지 · 현재 페이지 1건').waitFor();
  await otherContext.close();

  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
  await page.goto(base + '/#/applications');
  await page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('S11 real-session registration, metadata, status/history, job status/filter, pagination, retry and responsive layout passed.');
} catch (error) {
  await page.screenshot({ path: '.cache/s11/failure.png', fullPage: true });
  console.log('Failed page:', page.url(), await page.locator('main').innerText());
  throw error;
} finally { await browser.close(); }
