import assert from 'node:assert/strict';
import test from 'node:test';
import { createProjectsApi, projectLink } from '../src/api/projects.ts';
import { ApiError, createApiClient } from '../src/api/client.ts';

const input = { name: 'DevJob', description: null, startDate: '2026-01-01', endDate: null,
  role: 'backend', keyFeatures: null, outcome: null, projectUrl: 'https://example.com/project', skillIds: [1] };
const value = { ...input, id: 3, skills: [{ id: 1, name: 'Java' }] };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
test('project CRUD carries session and fresh CSRF and replaces skills', async () => {
  let stored; let tokens = 0;
  const api = createProjectsApi(createApiClient('/api', async (url, options) => {
    assert.equal(options.credentials, 'same-origin');
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: `t${++tokens}` });
    if (options.method !== 'GET') assert.equal(options.headers['X-CSRF-TOKEN'], `t${tokens}`);
    if (options.method === 'POST') { assert.deepEqual(JSON.parse(options.body), input); stored = value; return json(stored, 201); }
    if (options.method === 'PUT') { assert.deepEqual(JSON.parse(options.body).skillIds, []); stored = { ...stored, name: 'Updated', skills: [] }; return json(stored); }
    if (options.method === 'DELETE') { stored = undefined; return new Response(null, { status: 204 }); }
    return url.includes('?') ? json({ items: stored ? [stored] : [], page: 0, size: 20, totalElements: stored ? 1 : 0 }) : json(stored);
  }));
  assert.equal((await api.create(input)).id, 3);
  assert.equal((await api.get(3)).name, 'DevJob');
  assert.equal((await api.list()).items.length, 1);
  assert.deepEqual((await api.update(3, { ...input, name: 'Updated', skillIds: [] })).skills, []);
  await api.remove(3); assert.deepEqual((await api.list()).items, []); assert.equal(tokens, 3);
});
test('pagination and abort signal are passed through', async () => {
  const controller = new AbortController();
  const api = createProjectsApi(createApiClient('/api', async (url, options) => {
    assert.equal(url, '/api/me/projects?page=1&size=20'); assert.equal(options.signal, controller.signal);
    return json({ items: [], page: 1, size: 20, totalElements: 20 });
  }));
  assert.equal((await api.list(1, controller.signal)).page, 1);
});
test('malformed project data, unsafe URL, relation duplicates and invalid pages are rejected', async () => {
  for (const bad of [null, {}, { ...value, id: 0 }, { ...value, startDate: '2026-02-30' }, { ...value, endDate: '2025-01-01' },
    { ...value, role: 123 }, { ...value, skills: null }, { ...value, skills: [{ id: 0, name: 'Java' }] },
    { ...value, skills: [value.skills[0], value.skills[0]] }, { ...value, projectUrl: 'javascript:alert(1)' }]) {
    await assert.rejects(createProjectsApi(async () => bad).get(3), { code: 'INVALID_RESPONSE' });
  }
  for (const bad of [{ items: [value, value], page: 0, size: 20, totalElements: 2 },
    { items: [], page: 0, size: 20, totalElements: -1 }, { items: [], page: 1, size: 20, totalElements: 0 }]) {
    await assert.rejects(createProjectsApi(async () => bad).list(), { code: 'INVALID_RESPONSE' });
  }
  assert.equal(projectLink('https://example.com/project'), 'https://example.com/project');
  for (const url of ['javascript:alert(1)', 'https://user:password@example.com', '/relative', null]) assert.equal(projectLink(url), undefined);
});
test('invalid CSRF blocks mutation and failures propagate without retry', async () => {
  let calls = 0;
  await assert.rejects(createProjectsApi(async () => { calls++; return { token: 'bad' }; }).create(input), { code: 'INVALID_RESPONSE' });
  assert.equal(calls, 1);
  for (const status of [0, 400, 401, 403, 404, 500]) {
    calls = 0; const failure = new ApiError('failure', status, 'TEST');
    await assert.rejects(createProjectsApi(async path => { calls++; if (path === '/auth/csrf') return { headerName: 'X-CSRF-TOKEN', token: 'valid' }; throw failure; }).update(3, input), error => error === failure);
    assert.equal(calls, 2);
  }
  await assert.rejects(createProjectsApi(async () => { throw new Error('should not request'); }).get(0), TypeError);
});
