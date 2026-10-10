import test from 'node:test';
import assert from 'node:assert/strict';
import { createSavedJobsApi, recommendationCandidate } from '../src/api/saved-jobs.ts';
import { ApiError } from '../src/api/client.ts';

const manual = { id: 2, url: 'https://example.com/jobs/2', companyName: '테스트 회사', title: '백엔드 개발자',
  role: '백엔드 개발', careerLevel: null, location: null, employmentType: null, deadlineDate: null,
  note: null, description: 'Java 필수', createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z' };
const input = Object.fromEntries(Object.entries(manual).filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key)));
test('unified saved list and direct create/update/delete preserve CSRF and target', async () => {
  const calls = [];
  const api = createSavedJobsApi(async (path, options) => {
    calls.push([path, options]);
    if (path === '/auth/csrf') return { headerName: 'X-CSRF-TOKEN', token: 'fresh' };
    if (path === '/me/saved-jobs' && !options.method) return { items: [{ ...manual, kind: 'MANUAL', jobId: null,
      source: 'DIRECT', applicationStatus: 'PLANNED', analysisStatus: 'COMPLETED' }], page: 0, size: 20, totalElements: 1 };
    if (options.method === 'DELETE') return undefined;
    return manual;
  });
  assert.equal((await api.list()).items[0].applicationStatus, 'PLANNED');
  assert.equal((await api.list()).items[0].analysisStatus, 'COMPLETED');
  assert.equal((await api.create(input)).title, '백엔드 개발자');
  assert.equal((await api.update(2, input)).id, 2);
  await api.delete(2);
  assert.deepEqual(calls.filter(([, options]) => options?.method).map(([path, options]) => [path, options.method, options.csrfToken]),
    [['/me/saved-jobs', 'POST', 'fresh'], ['/me/saved-jobs/2', 'PUT', 'fresh'], ['/me/saved-jobs/2', 'DELETE', 'fresh']]);
});
test('personal AI result GET and explicit POST use the saved job and fresh CSRF', async () => {
  const calls = [];
  const result = { status: 'COMPLETED', requiredSkills: ['Java'], preferredSkills: [],
    analyzedAt: '2026-10-07T00:00:00Z', failureReason: null };
  const api = createSavedJobsApi(async (path, options) => {
    calls.push([path, options]);
    return path === '/auth/csrf' ? { headerName: 'X-CSRF-TOKEN', token: 'fresh' } : result;
  });
  assert.deepEqual(await api.analysis(2), result);
  assert.deepEqual(await api.requestAnalysis(2), result);
  assert.deepEqual(calls.map(([path, options]) => [path, options?.method, options?.csrfToken]),
    [['/me/saved-jobs/2/analysis', undefined, undefined], ['/auth/csrf', undefined, undefined],
      ['/me/saved-jobs/2/analysis', 'POST', 'fresh']]);
});
test('malformed unified list and CSRF response are rejected', async () => {
  await assert.rejects(createSavedJobsApi(async () => ({ items: [{ kind: 'MANUAL' }], page: 0, size: 20, totalElements: 1 })).list(),
    { code: 'INVALID_RESPONSE' });
  await assert.rejects(createSavedJobsApi(async () => ({})).create(input), { code: 'INVALID_RESPONSE' });
  const error = new ApiError('duplicate', 409, 'CONFLICT');
  await assert.rejects(createSavedJobsApi(async path => path === '/auth/csrf'
    ? { headerName: 'X-CSRF-TOKEN', token: 'fresh' } : Promise.reject(error)).create(input), failure => failure === error);
});
test('recommendation candidates use the collected job ID or personal saved job ID', async () => {
  assert.deepEqual(recommendationCandidate({ kind: 'COLLECTED', id: 88, jobId: 10 }), { kind: 'COLLECTED', id: 10 });
  assert.deepEqual(recommendationCandidate({ kind: 'MANUAL', id: 7, jobId: null }), { kind: 'MANUAL', id: 7 });
  assert.throws(() => recommendationCandidate({ kind: 'COLLECTED', id: 88, jobId: null }), { code: 'INVALID_RESPONSE' });
  const api = createSavedJobsApi(async () => ({ items: [{ ...manual, kind: 'COLLECTED', jobId: null,
    source: 'ALIO_RECRUITMENT', applicationStatus: null, analysisStatus: null }], page: 0, size: 20, totalElements: 1 }));
  await assert.rejects(api.list(), { code: 'INVALID_RESPONSE' });
});
