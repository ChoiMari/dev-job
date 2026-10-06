// Manual opt-in check against disposable PostgreSQL, a configured AI provider and real Backend/Frontend.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (process.env.S14_LIVE_TEST !== 'true' || !/^\d+$/.test(process.env.S14_JOB_ID || '')) {
  throw new Error('Set S14_LIVE_TEST=true and S14_JOB_ID for the disposable test job.');
}
const base = process.env.S14_FRONTEND_URL || 'http://127.0.0.1:5178';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  const email = `s14-ai-live-${Date.now()}@example.com`;
  const token = async () => (await (await page.request.get(`${base}/api/auth/csrf`)).json()).token;
  let response = await page.request.post(`${base}/api/auth/register`, {
    data: { email, password: 'password123' }, headers: { 'X-CSRF-TOKEN': await token() },
  });
  assert.equal(response.status(), 201);
  response = await page.request.post(`${base}/api/auth/login`, {
    data: { email, password: 'password123' }, headers: { 'X-CSRF-TOKEN': await token() },
  });
  assert.equal(response.status(), 200);
  response = await page.request.post(`${base}/api/jobs/${process.env.S14_JOB_ID}/analysis`, {
    headers: { 'X-CSRF-TOKEN': await token() },
  });
  assert.equal(response.status(), 202);
  let analysis;
  for (let attempt = 0; attempt < 90; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    response = await page.request.get(`${base}/api/jobs/${process.env.S14_JOB_ID}/analysis`);
    assert.equal(response.status(), 200);
    analysis = await response.json();
    if (analysis.status !== 'PENDING') break;
  }
  assert.equal(analysis?.status, 'COMPLETED');
  const skills = [...analysis.requiredSkills, ...analysis.preferredSkills];
  assert.ok(skills.length > 0);
  response = await page.request.get(`${base}/api/analytics/skills?desiredRole=S14%20Live%20Backend`);
  assert.equal(response.status(), 200);
  const demand = await response.json();
  assert.equal(demand.analyzedJobCount, 1);
  assert.equal(demand.totalElements, skills.length);
  assert.ok(demand.items.every(item => item.jobCount === 1 && item.ratio === 1));
  await page.goto(`${base}/#/analytics/skills?desiredRole=S14%20Live%20Backend`);
  await page.getByText(`분석 공고 1건 · 기술 ${skills.length}개`).waitFor();
  assert.equal(await page.locator('.market-list li').count(), skills.length);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, []);
  console.log(`S14 live AI flow passed: ${skills.length} normalized skills, one analyzed job, real API and UI.`);
} finally { await browser.close(); }
