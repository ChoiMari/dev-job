import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/api/client.ts';
import { validatePasswordChange, passwordChangeError } from '../src/pages/password-change.ts';

test('checks B01 password input before sending and keeps the confirmation local', () => {
  assert.equal(validatePasswordChange('password123', 'replacement123', 'replacement123'), '');
  for (const [current, next, confirmation] of [
    ['', 'replacement123', 'replacement123'],
    ['가'.repeat(25), 'replacement123', 'replacement123'],
    ['password123', 'short', 'short'],
    ['password123', '가'.repeat(25), '가'.repeat(25)],
    ['password123', 'password123', 'password123'],
    ['password123', 'replacement123', 'different123'],
  ]) assert.notEqual(validatePasswordChange(current, next, confirmation), '');
});

test('maps B01 input and CSRF errors to actionable messages without echoing secrets', () => {
  assert.match(passwordChangeError(new ApiError('입력값을 확인해 주세요.', 400, 'INVALID_INPUT')), /입력값/);
  assert.match(passwordChangeError(new ApiError('접근 권한이 없습니다.', 403, 'FORBIDDEN')), /보안 확인/);
  assert.doesNotMatch(passwordChangeError(new ApiError('입력값을 확인해 주세요.', 400, 'INVALID_INPUT')), /password123/);
});
