import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplicationsApi } from '../src/api/applications.ts';
import { createApiClient, ApiError } from '../src/api/client.ts';
import { createJobsApi } from '../src/api/jobs.ts';
import { statusChangeInput } from '../src/api/application-status.ts';

const job = { id: 1, title: 'Backend', company: { id: 2, name: 'Alpha' }, source: 'TEST',
  location: null, careerRequirement: null, employmentType: null, deadlineDate: null,
  matchRate: null, bookmarked: false, applicationStatus: 'PLANNED' };
const application = { id: 3, job, personalSavedJob: null, currentStatus: 'PLANNED', appliedDate: null, note: null, nextScheduleAt: null,
  createdAt: '2026-10-06T01:00:00Z', updatedAt: '2026-10-06T01:00:00Z' };
const history = [{ id: 4, fromStatus: null, toStatus: 'PLANNED', changedAt: application.createdAt }];
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('status move preserves an existing application date and requests one only when needed', () => {
  assert.deepEqual(statusChangeInput('APPLIED', '2026-10-13'), { status: 'APPLIED' });
  assert.deepEqual(statusChangeInput('INTERVIEW', '2026-10-13'), { status: 'INTERVIEW' });
  assert.deepEqual(statusChangeInput('PLANNED', '2026-10-13'), { status: 'PLANNED' });
  assert.deepEqual(statusChangeInput('APPLIED', null, '2026-10-13'), { status: 'APPLIED', appliedDate: '2026-10-13' });
  assert.deepEqual(statusChangeInput('WITHDRAWN', null), { status: 'WITHDRAWN', appliedDate: null });
});

test('registration, partial PATCH and status change use fresh CSRF and same-origin sessions', async () => {
  const calls = [];
  const api = createApplicationsApi(createApiClient('/api', async (path, options) => {
    assert.equal(options.credentials, 'same-origin'); calls.push([path, options]);
    if (path === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'fresh' });
    assert.equal(options.headers['X-CSRF-TOKEN'], 'fresh');
    return json(application);
  }));
  await api.create({ jobId: 1, status: 'PLANNED', appliedDate: null, note: null, nextScheduleAt: null });
  await api.update(3, { note: null });
  await api.changeStatus(3, { status: 'APPLIED', appliedDate: '2026-10-05' });
  assert.deepEqual(calls.map(([path]) => path), ['/api/auth/csrf', '/api/applications', '/api/auth/csrf',
    '/api/applications/3', '/api/auth/csrf', '/api/applications/3/status']);
  assert.equal(calls[1][1].method, 'POST');
  assert.deepEqual(JSON.parse(calls[3][1].body), { note: null });
  assert.equal(calls[5][1].method, 'PATCH');
});
test('delete sends a CSRF protected request for the selected application', async () => {
  const calls = [];
  const api = createApplicationsApi(createApiClient('/api', async (path, options) => {
    calls.push([path, options]);
    if (path === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'fresh' });
    return new Response(null, { status: 204 });
  }));
  await api.delete(3);
  assert.deepEqual(calls.map(([path]) => path), ['/api/auth/csrf', '/api/applications/3']);
  assert.equal(calls[1][1].method, 'DELETE');
  assert.equal(calls[1][1].headers['X-CSRF-TOKEN'], 'fresh');
});
test('paginated and status-filtered list, detail and history preserve cancellation and null first state', async () => {
  const controller = new AbortController();
  const api = createApplicationsApi(async (path, options) => {
    assert.equal(options.signal, controller.signal);
    if (path === '/applications') {
      assert.deepEqual(options.query, { status: 'PLANNED', page: 1, size: 20 });
      return { items: [application], page: 1, size: 20, totalElements: 21 };
    }
    return path.endsWith('/history') ? history : application;
  });
  assert.equal((await api.list({ status: 'PLANNED', page: 1, size: 20 }, controller.signal)).totalElements, 21);
  assert.deepEqual(await api.detail(3, controller.signal), application);
  assert.deepEqual(await api.history(3, controller.signal), history);
});
test('malformed application and history responses cannot become editable state', async () => {
  for (const value of [null, {}, { ...application, currentStatus: 'unknown' }, { ...application, note: 3 },
    { ...application, nextScheduleAt: '2026-10-10T14:00:00' }, { ...application, job: { ...job, applicationStatus: 'APPLIED' } }])
    await assert.rejects(createApplicationsApi(async () => value).detail(3), { code: 'INVALID_RESPONSE' });
  await assert.rejects(createApplicationsApi(async () => [{ ...history[0], toStatus: 'unknown' }]).history(3), { code: 'INVALID_RESPONSE' });
  let calls = 0;
  await assert.rejects(createApplicationsApi(async () => { calls++; return {}; }).update(3, { note: 'draft' }), { code: 'INVALID_RESPONSE' });
  assert.equal(calls, 1);
});
test('ownership, missing, conflict and authentication errors propagate without mutation retries', async () => {
  for (const status of [401, 403, 404, 409, 500]) {
    let calls = 0;
    const error = new ApiError('failed', status, 'TEST');
    await assert.rejects(createApplicationsApi(async path => {
      calls++; if (path === '/auth/csrf') return { headerName: 'X-CSRF-TOKEN', token: 'fresh' }; throw error;
    }).changeStatus(3, { status: 'WITHDRAWN' }), failure => failure === error);
    assert.equal(calls, 2);
  }
  let calls = 0;
  await assert.rejects(createApplicationsApi(async () => { calls++; }).detail(0), { code: 'INVALID_INPUT' });
  assert.equal(calls, 0);
});
test('job search forwards application status and rejects an unknown status in responses', async () => {
  const api = createJobsApi(async (path, options) => {
    assert.equal(options.query.applicationStatus, 'PLANNED');
    return { items: [job], page: 0, size: 20, totalElements: 1 };
  });
  assert.equal((await api.list({ applicationStatus: 'PLANNED' })).items[0].applicationStatus, 'PLANNED');
  await assert.rejects(createJobsApi(async () => ({ items: [{ ...job, applicationStatus: 'unknown' }], page: 0, size: 20, totalElements: 1 })).list({}), { code: 'INVALID_RESPONSE' });
});
