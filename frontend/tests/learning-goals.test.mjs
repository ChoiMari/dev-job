import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningGoalsApi } from '../src/api/learning-goals.ts';
import { createApiClient } from '../src/api/client.ts';

const goal = { id: 4, title: 'Java 심화', description: null, skill: { id: 7, name: 'Java' }, progressPercent: 80,
  completed: false, completedAt: null, createdAt: '2026-10-10T12:00:00Z', updatedAt: '2026-10-10T12:00:00Z' };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

test('learning goals list, detail and mutations use the B07 paths and CSRF', async () => {
  const calls = [];
  const api = createLearningGoalsApi(createApiClient('/api', async (url, options) => {
    calls.push([url, options]);
    if (url.endsWith('/auth/csrf')) return json({ headerName: 'X-CSRF-TOKEN', token: 'test' });
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    if (url.includes('/completion')) return json({ ...goal, progressPercent: 100, completed: true, completedAt: '2026-10-10T13:00:00Z' });
    if (options.method === 'GET' && url.includes('?')) return json({ items: [goal], page: 0, size: 20, totalElements: 1 });
    return json(goal);
  }));
  assert.equal((await api.list(0, false)).items[0].title, goal.title);
  assert.equal((await api.get(4)).id, 4);
  await api.create({ title: goal.title, progressPercent: 80 });
  await api.update(4, { progressPercent: 80 });
  assert.equal((await api.completion(4, true)).completed, true);
  await api.remove(4);
  assert.ok(calls.some(([url]) => url.includes('completed=false')));
  const mutations = calls.filter(([, options]) => ['POST', 'PATCH', 'DELETE'].includes(options.method));
  assert.equal(mutations.length, 4);
  assert.ok(mutations.every(([, options]) => options.headers['X-CSRF-TOKEN'] === 'test'));
});

test('learning goals reject invalid progress and inconsistent completion data', async () => {
  const api = createLearningGoalsApi(async () => ({ ...goal, completed: true }));
  await assert.rejects(api.get(4), { code: 'INVALID_RESPONSE' });
  await assert.rejects(api.create({ title: '목표', progressPercent: 101 }), TypeError);
  await assert.rejects(api.update(4, {}), TypeError);
  await assert.rejects(api.completion(0, true), TypeError);
  const empty = { items: [], page: 1, size: 20, totalElements: 0 };
  assert.deepEqual(await createLearningGoalsApi(async () => empty).list(1), empty);
});
