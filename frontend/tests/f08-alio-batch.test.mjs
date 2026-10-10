import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, createApiClient } from '../src/api/client.ts';
import { createAlioBatchApi } from '../src/api/alio-batch.ts';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const idle = { runId: null, status: 'IDLE', startedAt: null, updatedAt: null, finishedAt: null,
  processedPages: 0, created: 0, duplicates: 0, rejected: 0, failed: 0, sourceError: null };

test('admin status is GET only; explicit start sends CSRF protected POST with no body', async () => {
  const calls = [];
  const api = createAlioBatchApi(createApiClient('/api', async (url, options) => {
    calls.push([url, options.method, options.headers['X-CSRF-TOKEN'], options.body]);
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' });
    return json(options.method === 'POST' ? { ...idle, status: 'RUNNING', runId: '123e4567-e89b-12d3-a456-426614174000' } : idle,
      options.method === 'POST' ? 202 : 200);
  }));
  assert.equal((await api.status()).status, 'IDLE');
  assert.equal((await api.start()).status, 'RUNNING');
  assert.deepEqual(calls, [
    ['/api/admin/jobs/collections/alio', 'GET', undefined, undefined],
    ['/api/auth/csrf', 'GET', undefined, undefined],
    ['/api/admin/jobs/collections/alio', 'POST', 'csrf', undefined],
  ]);
});

test('admin 403, 409, 503 and partial failure remain distinct', async () => {
  for (const status of [403, 409, 503]) {
    const api = createAlioBatchApi(createApiClient('/api', async (url) => url === '/api/auth/csrf'
      ? json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' }) : json({ code: 'ERROR', message: '요청 실패' }, status)));
    await assert.rejects(api.status(), error => error instanceof ApiError && error.status === status);
    await assert.rejects(api.start(), error => error instanceof ApiError && error.status === status);
  }
  const partial = { ...idle, status: 'PARTIAL_FAILURE', runId: '123e4567-e89b-12d3-a456-426614174000',
    processedPages: 1000, sourceError: 'PAGE_LIMIT' };
  assert.equal((await createAlioBatchApi(async () => partial).status()).sourceError, 'PAGE_LIMIT');
  await assert.rejects(createAlioBatchApi(async () => ({ ...partial, status: 'SUCCESS' })).status(), { code: 'INVALID_RESPONSE' });
});
