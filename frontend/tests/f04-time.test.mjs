import assert from 'node:assert/strict';
import test from 'node:test';
import { dueFromLocal, dueLabel, localDueInput } from '../src/pages/todos/todoTime.ts';

test('Todo edit keeps the stored wall time visible in its original IANA zone', () => {
  const dueAt = '2026-10-15T10:00:00+09:00';
  assert.equal(localDueInput(dueAt, 'Asia/Seoul'), '2026-10-15T10:00');
  assert.equal(localDueInput(dueAt, 'America/New_York'), '2026-10-14T21:00');
  assert.match(dueLabel({ dueAt, dueTimeZone: 'Asia/Seoul' }), /2026/);
  assert.doesNotMatch(dueLabel({ dueAt, dueTimeZone: 'Asia/Seoul' }), /Asia\/Seoul/);
  assert.deepEqual(dueFromLocal(''), { dueAt: null, dueTimeZone: null });
  assert.throws(() => dueFromLocal('invalid'));
});
