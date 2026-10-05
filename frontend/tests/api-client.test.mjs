import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, createApiClient } from '../src/api/client.ts';

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});

test('returns resource JSON directly, encodes query, and uses same-origin cookies', async () => {
  const resource = { items: [], page: 0, size: 20, totalElements: 0 };
  const request = createApiClient('/api/', async (url, options) => {
    assert.equal(url, '/api/example?q=a%26b&page=0');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers['Content-Type'], undefined);
    return json(resource);
  });
  assert.deepEqual(await request('/example', { query: { q: 'a&b', page: 0, absent: undefined } }), resource);
});

test('serializes JSON request body and preserves method', async () => {
  const request = createApiClient('/api', async (_url, options) => {
    assert.equal(options.method, 'POST');
    assert.equal(options.body, '{"name":"example"}');
    assert.equal(options.headers['Content-Type'], 'application/json');
    return json({ id: 1 }, 201);
  });
  assert.deepEqual(await request('/example', { method: 'POST', body: { name: 'example' } }), { id: 1 });
});

test('204 does not require a response body', async () => {
  const request = createApiClient('/api', async () => new Response(null, { status: 204 }));
  assert.equal(await request('/example', { method: 'DELETE' }), undefined);
});

for (const status of [400, 401, 403, 404, 409, 500, 502, 503]) {
  test(`preserves documented error contract for HTTP ${status}`, async () => {
    const request = createApiClient('/api', async () => json({ code: 'EXAMPLE_ERROR', message: '오류 설명' }, status));
    await assert.rejects(request('/example'), error =>
      error instanceof ApiError && error.status === status && error.code === 'EXAMPLE_ERROR' && error.message === '오류 설명',
    );
  });
}

test('invalid JSON, HTML fallback and non-contract errors use safe messages', async () => {
  for (const [response, code] of [
    [new Response('<html>private diagnostics</html>', { headers: { 'Content-Type': 'text/html' } }), 'INVALID_RESPONSE'],
    [new Response('{private diagnostics', { headers: { 'Content-Type': 'application/json' } }), 'INVALID_RESPONSE'],
    [new Response('private diagnostics', { status: 502 }), 'HTTP_ERROR'],
    [json({ exception: 'private diagnostics' }, 500), 'HTTP_ERROR'],
  ]) {
    const request = createApiClient('/api', async () => response);
    await assert.rejects(request('/example'), error => error.code === code && !error.message.includes('private diagnostics'));
  }
});

test('network failures become a common error', async () => {
  const request = createApiClient('/api', async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(request('/example'), error => error.status === 0 && error.code === 'NETWORK_ERROR');
});

test('aborted requests remain aborted instead of becoming errors', async () => {
  const controller = new AbortController();
  controller.abort();
  const request = createApiClient('/api', async (_url, options) => {
    assert.equal(options.signal, controller.signal);
    throw new DOMException('Aborted', 'AbortError');
  });
  await assert.rejects(request('/example', { signal: controller.signal }), { name: 'AbortError' });
});

test('rejects paths that override the configured origin or embed a query', async () => {
  const request = createApiClient('/api', async () => { assert.fail('must not fetch'); });
  for (const path of ['https://example.com', '//example.com', 'example', '/example?q=1', '/example#hash']) {
    await assert.rejects(request(path), TypeError);
  }
});
