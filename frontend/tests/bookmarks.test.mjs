import test from 'node:test';
import assert from 'node:assert/strict';
import { createBookmarksApi } from '../src/api/bookmarks.ts';
import { createApiClient, ApiError } from '../src/api/client.ts';

const job = { id: 10, title: 'Backend', company: { id: 2, name: 'Alpha' }, source: 'MOCK', location: null,
  careerRequirement: null, employmentType: null, deadlineDate: null, matchRate: null, bookmarked: true, applicationStatus: null };
const item = { id: 1, job, createdAt: '2026-10-06T01:00:00Z' };
const page = { items: [item], page: 0, size: 20, totalElements: 1 };
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
test('save -> list -> delete uses jobId, fresh CSRF and session cookies', async () => {
  let csrf = 0;
  const calls = [];
  const api = createBookmarksApi(createApiClient('/api', async (url, options) => {
    assert.equal(options.credentials, 'same-origin'); calls.push([url, options]);
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: `csrf-${++csrf}` });
    if (options.method === 'POST') { assert.deepEqual(JSON.parse(options.body), { jobId: 10 }); assert.equal(options.headers['X-CSRF-TOKEN'], 'csrf-1'); return json(item); }
    if (options.method === 'DELETE') { assert.equal(url, '/api/bookmarks/10'); assert.equal(options.headers['X-CSRF-TOKEN'], 'csrf-2'); return new Response(null, { status: 204 }); }
    return json(page);
  }));
  assert.deepEqual(await api.add(10), item); assert.deepEqual(await api.list(), page); await api.remove(10);
  assert.equal(csrf, 2); assert.equal(calls.length, 5);
});
test('invalid responses and CSRF cannot produce a confirmed saved state', async () => {
  for (const value of [null, {}, { ...page, items: [{ ...item, job: { ...job, bookmarked: false } }] },
    { ...page, items: [item, item] }, { ...page, totalElements: -1 }, { ...page, page: 3 },
    { ...page, items: [{ ...item, createdAt: 'invalid' }] }])
    await assert.rejects(createBookmarksApi(async () => value).list(), { code: 'INVALID_RESPONSE' });
  let calls = 0;
  await assert.rejects(createBookmarksApi(async () => { calls++; return { token: '' }; }).add(10), { code: 'INVALID_RESPONSE' });
  assert.equal(calls, 1);
  await assert.rejects(createBookmarksApi(async path => path === '/auth/csrf' ? { headerName: 'X-CSRF-TOKEN', token: 'token' } : { ...item, job: { ...job, id: 11 } }).add(10), { code: 'INVALID_RESPONSE' });
});
test('duplicate, missing, auth, CSRF and network errors propagate without mutation retries', async () => {
  for (const status of [409, 404, 401, 403, 500, 0]) {
    let calls = 0; const failure = new ApiError('failure', status, 'TEST');
    const api = createBookmarksApi(async path => {
      if (path === '/auth/csrf') return { headerName: 'X-CSRF-TOKEN', token: 'token' };
      calls++; throw failure;
    });
    await assert.rejects(api.add(10), e => e === failure); assert.equal(calls, 1);
    await assert.rejects(api.remove(10), e => e === failure); assert.equal(calls, 2);
  }
});
test('invalid IDs and pagination make no request; list preserves abort signal', async () => {
  const api = createBookmarksApi(async () => { throw Error('must not call'); });
  for (const id of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(api.add(id), { code: 'INVALID_INPUT' }); await assert.rejects(api.remove(id), { code: 'INVALID_INPUT' });
  }
  for (const [p, s] of [[-1, 20], [0, 101], [0, 0], [1.5, 20], [2147483647, 20]])
    await assert.rejects(api.list(p, s), { code: 'INVALID_INPUT' });
  const controller = new AbortController();
  assert.deepEqual(await createBookmarksApi(async (path, options) => {
    assert.equal(path, '/bookmarks'); assert.equal(options.signal, controller.signal); return page;
  }).list(0, 20, controller.signal), page);
});
