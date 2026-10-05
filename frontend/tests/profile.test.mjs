import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiClient } from '../src/api/client.ts';
import { createProfileApi } from '../src/api/profile.ts';

const profile = { id: 3, email: 'owner@example.com', name: 'Owner', desiredRole: null,
  careerLevel: null, desiredLocation: null, introduction: null, education: null, certifications: null };
const json = (value, status = 200) => new Response(JSON.stringify(value),
  { status, headers: { 'Content-Type': 'application/json' } });

test('missing profile is distinct from saved profile, PUT uses session CSRF', async () => {
  let stored = null;
  const calls = [];
  const api = createProfileApi(createApiClient('/api', async (path, options) => {
    calls.push([path, options.method, options.credentials]);
    if (path === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' });
    if (options.method === 'PUT') {
      assert.equal(options.headers['X-CSRF-TOKEN'], 'csrf');
      assert.equal(JSON.parse(options.body).userId, undefined);
      stored = { ...JSON.parse(options.body), id: 3 };
      return json(stored, 201);
    }
    return stored ? json(stored) : json({ code: 'NOT_FOUND', message: 'Missing' }, 404);
  }));
  await assert.rejects(api.get(), { status: 404 });
  assert.deepEqual(await api.put({ ...profile, id: undefined }), profile);
  assert.deepEqual(await api.get(), profile);
  assert.deepEqual(calls.map(call => call[0]), ['/api/me/profile', '/api/auth/csrf', '/api/me/profile', '/api/me/profile']);
  assert.ok(calls.every(call => call[2] === 'same-origin'));
});

test('invalid profile response and CSRF are rejected', async () => {
  await assert.rejects(createProfileApi(async () => ({ id: 1, name: 'A' })).get(), { code: 'INVALID_RESPONSE' });
  await assert.rejects(createProfileApi(async () => ({ token: 'bad' })).put(profile), { code: 'INVALID_RESPONSE' });
});
