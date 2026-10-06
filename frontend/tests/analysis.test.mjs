import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalysisApi } from '../src/api/analysis.ts';
import { createApiClient } from '../src/api/client.ts';

const pending = { status: 'PENDING', requiredSkills: [], preferredSkills: [], analyzedAt: null, failureReason: null };
const completed = { status: 'COMPLETED', requiredSkills: [{ id: 1, name: 'Java' }], preferredSkills: [],
  analyzedAt: '2026-10-06T10:00:00Z', failureReason: null };
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
test('request uses CSRF, then GET returns reusable result without POST', async () => {
  const calls = [];
  const api = createAnalysisApi(createApiClient('/api', async (path, options) => {
    calls.push([path, options.method, options.headers['X-CSRF-TOKEN']]);
    assert.equal(options.credentials, 'same-origin');
    return json(path.endsWith('/auth/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'token' }
      : options.method === 'POST' ? pending : completed);
  }));
  assert.deepEqual(await api.request(5), pending);
  assert.deepEqual(await api.get(5), completed);
  assert.deepEqual(calls, [['/api/auth/csrf', 'GET', undefined], ['/api/jobs/5/analysis', 'POST', 'token'],
    ['/api/jobs/5/analysis', 'GET', undefined]]);
});
test('invalid AI response and invalid id are rejected', async () => {
  for (const value of [{ ...completed, requiredSkills: [{ id: 0, name: 'Java' }] },
    { ...pending, status: 'COMPLETED' }, { ...pending, requiredSkills: [{ id: 1, name: 'Java' }] }])
    await assert.rejects(createAnalysisApi(async () => value).get(1), { code: 'INVALID_RESPONSE' });
  await assert.rejects(createAnalysisApi(async () => { throw Error('unexpected request'); }).get(0), { code: 'INVALID_INPUT' });
});
