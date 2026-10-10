import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, createApiClient } from '../src/api/client.ts';
import { createNotificationsApi, notificationSource } from '../src/api/notifications.ts';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const now = '2026-10-10T00:00:00Z';
const item = { id: 8, type: 'INTERVIEW_REMINDER', sourceId: 4, scheduledAt: now, subject: '면접', createdAt: now, readAt: null };

test('notification page, source links, and idempotent read use their own resource', async () => {
  const calls = [];
  const api = createNotificationsApi(createApiClient('/api', async (url, options) => {
    calls.push([url, options.method, options.headers['X-CSRF-TOKEN']]);
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' });
    if (options.method === 'PATCH') { assert.equal(options.body, undefined); return new Response(null, { status: 204 }); }
    return json({ items: [item], page: 2, size: 20, totalElements: 41 });
  }));
  const page = await api.list(2);
  assert.equal(page.totalElements, 41);
  assert.equal(notificationSource(page.items[0]), '#/interviews/4');
  assert.equal(notificationSource({ ...item, type: 'TODO_REMINDER', sourceId: 9 }), '#/todos/9');
  await api.markRead(8);
  assert.deepEqual(calls, [
    ['/api/me/notifications?page=2&size=20', 'GET', undefined],
    ['/api/auth/csrf', 'GET', undefined],
    ['/api/me/notifications/8/read', 'PATCH', 'csrf'],
  ]);
});

test('notification API rejects malformed data and preserves ownership errors', async () => {
  for (const bad of [{ items: [{ ...item, type: 'EMAIL' }], page: 0, size: 20, totalElements: 1 },
    { items: [item, item], page: 0, size: 20, totalElements: 2 }]) {
    await assert.rejects(createNotificationsApi(async () => bad).list(), { code: 'INVALID_RESPONSE' });
  }
  const api = createNotificationsApi(createApiClient('/api', async (url) => url === '/api/auth/csrf'
    ? json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' }) : json({ code: 'NOT_FOUND', message: '없음' }, 404)));
  await assert.rejects(api.markRead(8), error => error instanceof ApiError && error.status === 404);
  await assert.rejects(api.markRead(0), TypeError);
});
