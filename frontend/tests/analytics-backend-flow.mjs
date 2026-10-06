// Manual end-to-end check against a disposable PostgreSQL database and real backend.
// The disposable database must contain one completed S14 job with two JobSkill rows.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.S14_FRONTEND_URL || 'http://127.0.0.1:5178';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  const email = `s14-backend-${Date.now()}@example.com`;
  const token = async () => (await (await page.request.get(`${base}/api/auth/csrf`)).json()).token;
  let response = await page.request.post(`${base}/api/auth/register`, {
    data: { email, password: 'password123' }, headers: { 'X-CSRF-TOKEN': await token() },
  });
  assert.equal(response.status(), 201);
  response = await page.request.post(`${base}/api/auth/login`, {
    data: { email, password: 'password123' }, headers: { 'X-CSRF-TOKEN': await token() },
  });
  assert.equal(response.status(), 200);
  response = await page.request.get(`${base}/api/analytics/skills?desiredRole=S14%20Backend`);
  assert.equal(response.status(), 200);
  const demand = await response.json();
  assert.equal(demand.analyzedJobCount, 1);
  assert.equal(demand.totalElements, 2);
  assert.deepEqual(demand.items.map(item => item.skill.name), ['Docker', 'Java']);
  assert.ok(demand.items.every(item => item.jobCount === 1 && item.ratio === 1));
  await page.goto(`${base}/#/analytics/skills?desiredRole=S14%20Backend`);
  await page.getByText('분석 공고 1건 · 기술 2개').waitFor();
  assert.equal(await page.locator('.market-list li').count(), 2);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('S14 real backend flow passed: one analyzed job, two skills, API and UI.');
} finally { await browser.close(); }
