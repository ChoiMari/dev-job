import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, createApiClient } from '../src/api/client.ts';
import { createTodosApi } from '../src/api/todos.ts';

const now = '2026-10-08T00:00:00Z';
const input = { title: '지원서 검토', description: null, dueAt: '2026-10-15T18:00:00+09:00', dueTimeZone: 'Asia/Seoul' };
const todo = { id: 7, ...input, category: '기타', reminderMinutes: 1440,
  completed: false, completedAt: null, createdAt: now, updatedAt: now };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('todo API uses session, fresh CSRF, detail and saved completion state', async () => {
  let stored; let tokenCount = 0;
  const api = createTodosApi(createApiClient('/api', async (url, options) => {
    assert.equal(options.credentials, 'same-origin');
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: `t${++tokenCount}` });
    if (options.method !== 'GET') assert.equal(options.headers['X-CSRF-TOKEN'], `t${tokenCount}`);
    if (options.method === 'POST') { assert.deepEqual(JSON.parse(options.body), input); stored = todo; return json(stored, 201); }
    if (options.method === 'PATCH' && url.endsWith('/completion')) {
      assert.deepEqual(JSON.parse(options.body), { completed: true });
      stored = { ...stored, completed: true, completedAt: now }; return json(stored);
    }
    if (options.method === 'PATCH') { assert.deepEqual(JSON.parse(options.body), { title: '수정' }); stored = { ...stored, title: '수정' }; return json(stored); }
    if (options.method === 'DELETE') { stored = undefined; return new Response(null, { status: 204 }); }
    if (url.includes('?')) return json({ items: stored ? [stored] : [], page: 0, size: 20, totalElements: stored ? 1 : 0 });
    return json(stored);
  }));
  assert.equal((await api.create(input)).id, 7);
  assert.equal((await api.get(7)).title, input.title);
  assert.equal((await api.update(7, { title: '수정' })).title, '수정');
  assert.equal((await api.complete(7, true)).completed, true);
  assert.equal((await api.list()).items[0].completedAt, now);
  await api.remove(7);
  assert.deepEqual((await api.list()).items, []);
  assert.equal(tokenCount, 4);
});

test('todo list passes filter, page and abort signal', async () => {
  const controller = new AbortController();
  const api = createTodosApi(createApiClient('/api', async (url, options) => {
    assert.equal(url, '/api/me/todos?page=2&size=20&completed=false');
    assert.equal(options.signal, controller.signal);
    return json({ items: [], page: 2, size: 20, totalElements: 40 });
  }));
  assert.equal((await api.list(2, 'open', controller.signal)).page, 2);
});

test('category management sends icon, color, order and deletion with CSRF', async () => {
  const category = { id: 9, name: '건강', iconKey: 'health', colorKey: 'pink', sortOrder: 8 };
  const calls = []; let tokens = 0;
  const api = createTodosApi(createApiClient('/api', async (url, options) => {
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: `t${++tokens}` });
    calls.push({ url, method: options.method, body: options.body && JSON.parse(options.body), token: options.headers?.['X-CSRF-TOKEN'] });
    if (url.endsWith('/categories/order')) return json([{ ...category, sortOrder: 0 }]);
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    if (options.method === 'PATCH') return json({ ...category, name: '운동' });
    return json(category, 201);
  }));
  assert.equal((await api.createCategory('건강', 'health', 'pink')).iconKey, 'health');
  assert.equal((await api.updateCategory(9, { name: '운동', iconKey: 'health', colorKey: 'pink' })).name, '운동');
  assert.equal((await api.reorderCategories([9]))[0].sortOrder, 0);
  await api.deleteCategory(9);
  assert.deepEqual(calls.map(call => [call.method, call.url]), [
    ['POST', '/api/me/todos/categories'], ['PATCH', '/api/me/todos/categories/9'],
    ['PUT', '/api/me/todos/categories/order'], ['DELETE', '/api/me/todos/categories/9'],
  ]);
  assert.deepEqual(calls[0].body, { name: '건강', iconKey: 'health', colorKey: 'pink' });
  assert.deepEqual(calls[2].body, { ids: [9] });
  assert.deepEqual(calls.map(call => call.token), ['t1', 't2', 't3', 't4']);
});

test('todo responses reject malformed states and mutation failures propagate', async () => {
  for (const bad of [null, {}, { ...todo, id: 0 }, { ...todo, title: '' }, { ...todo, dueTimeZone: null },
    { ...todo, dueTimeZone: 'Invalid/Zone' },
    { ...todo, completed: true }, { ...todo, dueAt: 'tomorrow' }]) {
    await assert.rejects(createTodosApi(async () => bad).get(7), { code: 'INVALID_RESPONSE' });
  }
  await assert.rejects(createTodosApi(async () => ({ items: [todo, todo], page: 0, size: 20, totalElements: 2 })).list(),
    { code: 'INVALID_RESPONSE' });
  await assert.rejects(createTodosApi(async () => ({ token: 'bad' })).create(input), { code: 'INVALID_RESPONSE' });
  const failure = new ApiError('서버 오류', 500, 'INTERNAL_SERVER_ERROR');
  await assert.rejects(createTodosApi(async path => {
    if (path === '/auth/csrf') return { headerName: 'X-CSRF-TOKEN', token: 'valid' };
    throw failure;
  }).complete(7, true), error => error === failure);
  await assert.rejects(createTodosApi(async () => { throw new Error('request not expected'); }).get(0), TypeError);
});
