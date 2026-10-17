import assert from 'node:assert/strict';
import test from 'node:test';
import { dueFromLocal, dueLabel, localDueInput, todoDday } from '../src/pages/todos/todoTime.ts';

test('Todo edit keeps the stored wall time visible in its original IANA zone', () => {
  const dueAt = '2026-10-15T10:00:00+09:00';
  assert.equal(localDueInput(dueAt, 'Asia/Seoul'), '2026-10-15T10:00');
  assert.equal(localDueInput(dueAt, 'America/New_York'), '2026-10-14T21:00');
  assert.match(dueLabel({ dueAt, dueTimeZone: 'Asia/Seoul' }), /2026/);
  assert.doesNotMatch(dueLabel({ dueAt, dueTimeZone: 'Asia/Seoul' }), /Asia\/Seoul/);
  assert.deepEqual(dueFromLocal(''), { dueAt: null, dueTimeZone: null });
  assert.throws(() => dueFromLocal('invalid'));
});

test('dashboard deadline counts calendar days in the device zone across midnight and daylight saving', () => {
  const now = new Date('2026-03-08T06:30:00Z');
  assert.equal(todoDday('2026-03-08T06:59:00Z', now, 'America/New_York'), 'D-Day');
  assert.equal(todoDday('2026-03-09T04:00:00Z', now, 'America/New_York'), 'D-1');
  assert.equal(todoDday('2026-03-07T04:00:00Z', now, 'America/New_York'), 'D+2');
  assert.equal(todoDday(null, now, 'America/New_York'), '기한 없음');
});
