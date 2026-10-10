import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/api/client.ts';
import { anonymousRoute, sessionFailureKind } from '../src/session.ts';

test('only a /auth/me 401 means there is no session', () => {
  assert.equal(sessionFailureKind(new ApiError('미인증', 401, 'UNAUTHORIZED')), 'anonymous');
  for (const status of [0, 403, 500, 503]) {
    assert.equal(sessionFailureKind(new ApiError('조회 실패', status, 'ERROR')), 'error');
  }
  assert.equal(sessionFailureKind(new Error('invalid response')), 'error');
});

test('anonymous root stays public while protected deep links redirect to login', () => {
  assert.equal(anonymousRoute('/'), 'home');
  assert.equal(anonymousRoute('/login'), 'auth');
  assert.equal(anonymousRoute('/register'), 'auth');
  for (const path of ['/jobs', '/jobs/42', '/states', '/unknown']) {
    assert.equal(anonymousRoute(path), 'login');
  }
});
