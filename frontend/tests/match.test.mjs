import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchApi } from '../src/api/match.ts';
import { createJobsApi } from '../src/api/jobs.ts';
import { createApiClient } from '../src/api/client.ts';

const group = (matched, missing) => ({ matched, missing, total: matched.length + missing.length });
const match = { available: true, required: group([{ id: 1, name: 'Java' }], [{ id: 2, name: 'SQL' }]),
  preferred: group([], []), matchRate: 50, reason: null };
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
test('match uses session GET and validates compared skills', async () => {
  const calls = [];
  const api = createMatchApi(createApiClient('/api', async (path, options) => {
    calls.push(path); assert.equal(options.credentials, 'same-origin'); return json(match);
  }));
  assert.deepEqual(await api.get(7), match);
  assert.deepEqual(calls, ['/api/jobs/7/match']);
});
test('empty comparison and invalid responses remain distinct', async () => {
  const empty = { available: false, required: group([], []), preferred: group([], []),
    matchRate: null, reason: 'USER_SKILLS_EMPTY' };
  assert.deepEqual(await createMatchApi(async () => empty).get(1), empty);
  for (const value of [{ ...match, matchRate: 101 }, { ...match, required: { ...match.required, total: 3 } },
    { ...empty, reason: null }, { ...empty, required: group([{ id: 1, name: 'Java' }], []) }])
    await assert.rejects(createMatchApi(async () => value).get(1), { code: 'INVALID_RESPONSE' });
  await assert.rejects(createMatchApi(async () => { throw Error('unexpected request'); }).get(0), { code: 'INVALID_INPUT' });
});
test('job list forwards skill and score conditions', async () => {
  let path;
  const api = createJobsApi(createApiClient('/api', async target => {
    path = target; return json({ items: [], page: 0, size: 20, totalElements: 0 });
  }));
  await api.list({ skillId: 12, minMatchRate: 67, sort: 'matchRate' });
  const query = new URL('http://localhost' + path).searchParams;
  assert.equal(query.get('skillId'), '12'); assert.equal(query.get('minMatchRate'), '67');
  assert.equal(query.get('sort'), 'matchRate');
});
