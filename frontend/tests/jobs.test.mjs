import test from 'node:test';
import assert from 'node:assert/strict';
import { createJobsApi } from '../src/api/jobs.ts';
import { createApiClient, ApiError } from '../src/api/client.ts';

const item = { id: 1, title: 'Backend', company: { id: 2, name: 'Alpha' }, source: 'MOCK',
  location: null, careerRequirement: null, employmentType: null, deadlineDate: null,
  matchRate: null, bookmarked: false, applicationStatus: null };
const detail = { ...item, description: 'Java\n<script>original text</script>', postedDate: null,
  sourceUrl: 'https://example.com/jobs/1', requiredSkills: [], preferredSkills: [], analysis: null };
const json = v => new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json' } });
test('search and list -> detail preserve cookie contract, pagination and original text without analysis', async () => {
  const calls = [];
  const api = createJobsApi(createApiClient('/api', async (path, options) => {
    calls.push(path); assert.equal(options.credentials, 'same-origin');
    return json(path.startsWith('/api/jobs?') ? { items: [item], page: 1, size: 20, totalElements: 21 } : detail);
  }));
  const page = await api.list({ q: 'Java & Spring', location: '서울', careerLevel: '신입', company: 'Alpha',
    employmentType: '정규직', deadlineBefore: '2026-12-31', page: 1, size: 20, sort: 'deadline' });
  assert.equal(page.totalElements, 21);
  assert.deepEqual(await api.detail(page.items[0].id), detail);
  const query = new URL('http://localhost' + calls[0]).searchParams;
  assert.equal(query.get('q'), 'Java & Spring'); assert.equal(query.get('page'), '1'); assert.equal(query.get('sort'), 'deadline');
  assert.equal(calls[1], '/api/jobs/1');
});
test('empty page is valid; malformed resource and unsafe source URL are rejected', async () => {
  const empty = { items: [], page: 5, size: 20, totalElements: 0 };
  assert.deepEqual(await createJobsApi(async () => empty).list({}), empty);
  for (const value of [null, {}, { ...empty, items: [{}] }, { ...empty, totalElements: -1 }])
    await assert.rejects(createJobsApi(async () => value).list({}), { code: 'INVALID_RESPONSE' });
  for (const value of [{ ...detail, sourceUrl: 'javascript:alert(1)' }, { ...detail, description: 3 }])
    await assert.rejects(createJobsApi(async () => value).detail(1), { code: 'INVALID_RESPONSE' });
});
test('missing job and server failures propagate without retry; malformed ID makes no request', async () => {
  for (const status of [404, 500, 401]) {
    let calls = 0;
    const failure = new ApiError('failure', status, 'TEST');
    await assert.rejects(createJobsApi(async () => { calls++; throw failure; }).detail(1), e => e === failure);
    assert.equal(calls, 1);
  }
  await assert.rejects(createJobsApi(async () => { throw Error('must not call'); }).detail(-1), { code: 'INVALID_INPUT' });
});
test('abort signal reaches list and detail requests', async () => {
  const controller = new AbortController();
  const api = createJobsApi(async (path, options) => {
    assert.equal(options.signal, controller.signal);
    return path === '/jobs' ? { items: [], page: 0, size: 20, totalElements: 0 } : detail;
  });
  await api.list({}, controller.signal); await api.detail(1, controller.signal);
});
