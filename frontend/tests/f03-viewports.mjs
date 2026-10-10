// Manual visual smoke test: PLAYWRIGHT_MODULE=<installed playwright path> node tests/f03-viewports.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.F03_FRONTEND_URL || 'http://127.0.0.1:5179';
const longTitle = '긴 채용공고 제목 '.repeat(24);
const job = { id: 10, title: longTitle, company: { id: 3, name: '예시 기업' }, source: 'ALIO_RECRUITMENT',
  location: '서울', careerRequirement: '신입', employmentType: '정규직', deadlineDate: '2026-12-31',
  matchRate: null, bookmarked: false, applicationStatus: null, role: 'DEVELOPMENT' };
const manual = { id: 7, kind: 'MANUAL', jobId: null, source: 'DIRECT', url: 'https://example.com/jobs/7',
  companyName: '예시 기업', title: longTitle, role: null, careerLevel: null, location: null,
  employmentType: null, deadlineDate: null, note: null, description: 'Java', analysisStatus: null,
  applicationStatus: null, createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z' };
const application = { id: 4, job: { ...job, applicationStatus: 'PLANNED' }, personalSavedJob: null,
  currentStatus: 'PLANNED', appliedDate: null, nextScheduleAt: null, note: null,
  createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z' };
const pages = [
  { path: '/jobs', api: '/api/jobs', heading: '채용공고 탐색', item: '.job-card', data: job },
  { path: '/bookmarks', api: '/api/me/saved-jobs', heading: '내 관심공고', item: '.job-card', data: manual },
  { path: '/applications', api: '/api/applications', heading: '지원 진행 현황', item: '.application-card', data: application },
];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
try {
  for (const width of [390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    let mode = 'long';
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me') return route.fulfill({ json: { id: 1, email: 'viewer@example.com' } });
      if (path === '/api/me/saved-jobs/7') return route.fulfill({ json: manual });
      const target = pages.find(entry => entry.api === path);
      if (!target) return route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: '없음' } });
      await new Promise(resolve => setTimeout(resolve, 250));
      if (mode === 'error') return route.fulfill({ status: 503, json: { code: 'SERVICE_UNAVAILABLE', message: '목록 오류' } });
      return route.fulfill({ json: { items: mode === 'empty' ? [] : [target.data], page: 0, size: 20,
        totalElements: mode === 'empty' ? 0 : 1 } });
    });
    for (const entry of pages) {
      for (mode of ['long', 'empty', 'error']) {
        console.log(`checking ${width} ${entry.path} ${mode}`);
        await page.goto(`${base}/#${entry.path}?probe=${mode}`);
        await page.reload();
        await page.getByRole('heading', { name: entry.heading }).waitFor();
        const loading = await page.getByText(/불러오고 있습니다|검색하고 있습니다/).count();
        if (mode === 'long') await page.locator(entry.item).first().waitFor();
        if (mode === 'long' && entry.path === '/bookmarks') {
          await page.locator('.job-title-button').click();
          await page.getByRole('heading', { name: longTitle }).waitFor();
          await page.getByRole('button', { name: '← 관심 공고 목록' }).click();
        }
        if (mode === 'empty') await page.getByText(/결과가 없습니다|저장한 관심공고가 없습니다|지원 기록이 없습니다/).waitFor();
        if (mode === 'error') await page.getByText('목록 오류').waitFor();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        results.push({ width, page: entry.path, mode, loading: loading > 0, overflow });
        assert.ok(overflow <= 1, `${entry.path} ${mode} ${width}px horizontal overflow: ${overflow}`);
      }
    }
    await page.close();
  }
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
