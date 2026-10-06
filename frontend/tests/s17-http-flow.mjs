// Run manually against an isolated S17 database with seven S17 fixture jobs.
import assert from 'node:assert/strict';

const base = process.env.S17_API_URL || 'http://127.0.0.1:8097';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function client() {
  let cookie = '';
  async function request(path, { method = 'GET', body, csrf = false } = {}) {
    let token;
    if (csrf) token = (await request('/api/auth/csrf')).body.token;
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { 'X-CSRF-TOKEN': token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get('set-cookie');
    const session = setCookie?.match(/JSESSIONID=[^;,]*/);
    if (session) cookie = session[0];
    const value = response.status === 204 ? null : await response.json();
    return { status: response.status, body: value, headers: response.headers };
  }
  return request;
}

const owner = client();
const stranger = client();
const email = `s17-${Date.now()}@example.com`;
const otherEmail = `s17-other-${Date.now()}@example.com`;
const register = async (request, address) => {
  assert.equal((await request('/api/auth/register', {
    method: 'POST', body: { email: address, password: 'password123' }, csrf: true,
  })).status, 201);
  assert.equal((await request('/api/auth/login', {
    method: 'POST', body: { email: address, password: 'password123' }, csrf: true,
  })).status, 200);
};

await register(owner, email);
assert.equal((await owner('/api/auth/me')).body.email, email);
assert.equal((await owner('/api/me/profile')).status, 404);
assert.equal((await owner('/api/me/profile', {
  method: 'PUT', csrf: true, body: { email, name: 'S17 Tester', desiredRole: 'S17 Backend' },
})).status, 201);
assert.equal((await owner('/api/me/profile')).body.desiredRole, 'S17 Backend');

const java = await owner('/api/me/skills', { method: 'POST', csrf: true, body: { name: 'Java' } });
assert.equal(java.status, 201);
assert.equal((await owner('/api/me/skills')).body.items[0].name, 'Java');
const project = await owner('/api/me/projects', {
  method: 'POST', csrf: true,
  body: { name: 'S17 project', startDate: '2026-01-01', skillIds: [java.body.id] },
});
assert.equal(project.status, 201);
assert.equal((await owner(`/api/me/projects/${project.body.id}`)).body.name, 'S17 project');

const jobs = (await owner('/api/jobs?q=S17%20Backend&size=20')).body.items;
assert.equal(jobs.length, 7);
const analyzed = jobs.find(job => job.title === 'S17 Backend 1');
const unanalyzed = jobs.find(job => job.title === 'S17 Backend 7');
assert.ok(analyzed && unanalyzed);
assert.equal((await owner(`/api/jobs/${analyzed.id}`)).body.analysis.status, 'COMPLETED');
assert.equal((await owner(`/api/jobs/${unanalyzed.id}`)).body.analysis, null);
assert.equal((await owner(`/api/jobs/${analyzed.id}/analysis`)).body.status, 'COMPLETED');
assert.equal((await owner(`/api/jobs/${analyzed.id}/match`)).body.matchRate, 50);

assert.equal((await owner('/api/bookmarks', { method: 'POST', csrf: true, body: { jobId: analyzed.id } })).status, 201);
assert.equal((await owner('/api/bookmarks')).body.totalElements, 1);
const application = await owner('/api/applications', {
  method: 'POST', csrf: true,
  body: { jobId: analyzed.id, status: 'PLANNED', appliedDate: null, note: 'S17', nextScheduleAt: null },
});
assert.equal(application.status, 201);
assert.equal((await owner(`/api/applications/${application.body.id}/history`)).body.length, 1);
assert.equal((await owner(`/api/applications/${application.body.id}/status`, {
  method: 'PATCH', csrf: true, body: { status: 'APPLIED', appliedDate: '2026-10-07' },
})).status, 200);
assert.equal((await owner(`/api/applications/${application.body.id}/history`)).body.length, 2);
assert.equal((await owner(`/api/jobs/${analyzed.id}`)).body.applicationStatus, 'APPLIED');

const market = await owner('/api/analytics/skills?desiredRole=S17%20Backend');
assert.equal(market.body.analyzedJobCount, 6);
assert.equal(market.body.totalElements, 2);
const gap = await owner('/api/me/skill-gap');
assert.equal(gap.body.analyzedJobCount, 6);
assert.equal(gap.body.provisional, true);
assert.deepEqual(gap.body.items.map(item => item.skill.name), ['Docker']);
const dashboard = await owner('/api/dashboard');
assert.equal(dashboard.body.applicationCounts.APPLIED, 1);
assert.equal(dashboard.body.bookmarkCount, 1);
assert.equal(dashboard.body.nextActions[0].applicationId, application.body.id);
assert.ok(dashboard.body.recommendedJobs.every(job => job.id !== analyzed.id));
assert.deepEqual(dashboard.body.skillGapPreview.map(skill => skill.name), ['Docker']);

await register(stranger, otherEmail);
assert.equal((await stranger('/api/bookmarks')).body.totalElements, 0);
assert.equal((await stranger('/api/applications')).body.totalElements, 0);
assert.equal((await stranger(`/api/me/projects/${project.body.id}`)).status, 403);
assert.equal((await stranger(`/api/applications/${application.body.id}`)).status, 403);
assert.equal((await stranger('/api/dashboard')).body.bookmarkCount, 0);
assert.equal((await owner('/api/bookmarks', { method: 'POST', body: { jobId: unanalyzed.id } })).status, 403);

assert.equal((await owner(`/api/jobs/${unanalyzed.id}/analysis`, { method: 'POST', csrf: true })).status, 202);
let failed = false;
for (let i = 0; i < 40; i++) {
  const result = await owner(`/api/jobs/${unanalyzed.id}/analysis`);
  if (result.body.status === 'FAILED') { failed = true; break; }
  await pause(100);
}
assert.equal(failed, true, 'missing AI key should produce FAILED');
assert.equal((await owner(`/api/jobs/${unanalyzed.id}`)).status, 200);
assert.equal((await owner('/api/jobs?q=S17%20Backend')).body.totalElements, 7);
assert.equal((await owner('/api/bookmarks')).body.totalElements, 1);
assert.equal((await owner('/api/applications')).body.totalElements, 1);
assert.equal((await owner('/api/dashboard')).status, 200);

assert.equal((await owner('/api/auth/logout', { method: 'POST', csrf: true })).status, 204);
assert.equal((await owner('/api/auth/me')).status, 401);
console.log('S17 HTTP integration passed: auth, profile, skills, project, jobs, CRM, analysis failure, match, market, gap, dashboard, ownership and CSRF.');
