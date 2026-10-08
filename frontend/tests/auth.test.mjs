import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthApi } from '../src/api/auth.ts';
import { ApiError, createApiClient } from '../src/api/client.ts';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

test('register -> login -> current user -> logout uses fresh CSRF and cookie credentials', async () => {
  const calls = [];
  let token = 0;
  const current = { id: 1, email: 'user@example.com' };
  const auth = createAuthApi(createApiClient('/api', async (path, options) => {
    calls.push(path);
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.headers.Authorization, undefined);
    if (path === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: `csrf-${++token}` });
    if (options.method === 'POST') assert.equal(options.headers['X-CSRF-TOKEN'], `csrf-${token}`);
    if (path === '/api/auth/register') {
      assert.deepEqual(JSON.parse(options.body), { email: current.email, password: 'password123' });
      return json(current, 201);
    }
    if (path === '/api/auth/login') return json({ user: current });
    if (path === '/api/auth/me') return json(current);
    return new Response(null, { status: 204 });
  }));
  assert.deepEqual(await auth.register(current.email, 'password123'), current);
  assert.deepEqual(await auth.login(current.email, 'password123'), current);
  assert.deepEqual(await auth.me(), current);
  assert.equal(await auth.logout(), undefined);
  assert.deepEqual(calls, ['/api/auth/csrf', '/api/auth/register', '/api/auth/csrf', '/api/auth/login',
    '/api/auth/me', '/api/auth/csrf', '/api/auth/logout']);
});

test('invalid CSRF response prevents mutations', async () => {
  let calls = 0;
  const auth = createAuthApi(async () => { calls++; return { token: 'wrong-header' }; });
  await assert.rejects(auth.login('user@example.com', 'password123'), { code: 'INVALID_RESPONSE' });
  assert.equal(calls, 1);
});

test('rejects invalid user and login resource contracts', async () => {
  for (const value of [null, {}, { id: -1, email: 'user@example.com' }, { id: 1, email: null }]) {
    await assert.rejects(createAuthApi(async () => value).me(), { code: 'INVALID_RESPONSE' });
  }
  const auth = createAuthApi(async path => path === '/auth/csrf'
    ? { headerName: 'X-CSRF-TOKEN', token: 'token' } : { id: 1, email: 'user@example.com' });
  await assert.rejects(auth.login('user@example.com', 'password123'), { code: 'INVALID_RESPONSE' });
});

test('propagates duplicate, invalid credentials, CSRF and network errors without retry', async () => {
  for (const status of [0, 401, 403, 409]) {
    let calls = 0;
    const failure = new ApiError('error', status, 'TEST_ERROR');
    const auth = createAuthApi(async path => {
      calls++;
      if (path === '/auth/csrf') return { headerName: 'X-CSRF-TOKEN', token: 'token' };
      throw failure;
    });
    await assert.rejects(auth.login('user@example.com', 'password123'), error => error === failure);
    assert.equal(calls, 2);
  }
});

test('password change fetches CSRF, sends only current/new passwords with PATCH, and accepts empty 204', async () => {
  const calls = [];
  const auth = createAuthApi(createApiClient('/api', async (path, options) => {
    calls.push(path);
    assert.equal(options.credentials, 'same-origin');
    if (path === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'fresh-token' });
    assert.equal(path, '/api/auth/password');
    assert.equal(options.method, 'PATCH');
    assert.equal(options.headers['X-CSRF-TOKEN'], 'fresh-token');
    assert.deepEqual(JSON.parse(options.body), {
      currentPassword: 'password123', newPassword: 'replacement123',
    });
    return new Response(null, { status: 204 });
  }));
  assert.equal(await auth.changePassword('password123', 'replacement123'), undefined);
  assert.deepEqual(calls, ['/api/auth/csrf', '/api/auth/password']);
});

test('password change propagates contract errors once and rejects an unexpected success body', async () => {
  for (const status of [400, 401, 403]) {
    let mutations = 0;
    const auth = createAuthApi(createApiClient('/api', async path => {
      if (path === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'token' });
      mutations++;
      return json({ code: status === 400 ? 'INVALID_INPUT' : status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', message: '오류' }, status);
    }));
    await assert.rejects(auth.changePassword('password123', 'replacement123'), { status });
    assert.equal(mutations, 1);
  }
  const unexpected = createAuthApi(async path => path === '/auth/csrf'
    ? { headerName: 'X-CSRF-TOKEN', token: 'token' } : { success: true });
  await assert.rejects(unexpected.changePassword('password123', 'replacement123'), { code: 'INVALID_RESPONSE' });
});
