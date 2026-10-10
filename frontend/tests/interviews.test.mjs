import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, createApiClient } from '../src/api/client.ts';
import { createInterviewsApi } from '../src/api/interviews.ts';
import { scheduleFromLocal, scheduleLabel, zonedLocalInput } from '../src/pages/interviews/interviewTime.ts';

const now = '2026-10-10T00:00:00Z';
const input = { applicationId: 12, title: '1차 면접', startsAt: '2026-10-15T10:00:00+09:00', timeZone: 'Asia/Seoul' };
const scheduled = { id: 7, ...input, status: 'SCHEDULED', cancelledAt: null, createdAt: now, updatedAt: now };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('interview CRUD and state changes stay on the independent personal resource', async () => {
  let stored; let tokens = 0;
  const api = createInterviewsApi(createApiClient('/api', async (url, options) => {
    assert.equal(options.credentials, 'same-origin');
    assert.ok(!url.includes('nextScheduleAt'));
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: `t${++tokens}` });
    if (options.method !== 'GET') assert.equal(options.headers['X-CSRF-TOKEN'], `t${tokens}`);
    if (options.method === 'POST' && url === '/api/me/interviews') {
      assert.deepEqual(JSON.parse(options.body), input); stored = scheduled; return json(stored, 201);
    }
    if (url.endsWith('/cancel')) { assert.equal(options.body, undefined); stored = { ...stored, status: 'CANCELLED', cancelledAt: now }; return json(stored); }
    if (url.endsWith('/reactivate')) { assert.equal(options.body, undefined); stored = { ...stored, status: 'SCHEDULED', cancelledAt: null }; return json(stored); }
    if (options.method === 'PATCH') {
      assert.deepEqual(JSON.parse(options.body), { applicationId: null, title: '최종 면접' });
      stored = { ...stored, applicationId: null, title: '최종 면접' }; return json(stored);
    }
    if (url.includes('?')) return json({ items: [stored], page: 0, size: 20, totalElements: 1 });
    return json(stored);
  }));
  assert.equal((await api.create(input)).id, 7);
  assert.equal((await api.get(7)).applicationId, 12);
  assert.equal((await api.update(7, { applicationId: null, title: '최종 면접' })).applicationId, null);
  assert.equal((await api.cancel(7)).status, 'CANCELLED');
  assert.equal((await api.list()).items[0].status, 'CANCELLED');
  assert.equal((await api.reactivate(7)).status, 'SCHEDULED');
  assert.equal(tokens, 4);
});

test('interview ownership, missing ID and malformed responses remain distinct', async () => {
  for (const status of [403, 404]) {
    const api = createInterviewsApi(createApiClient('/api', async () => json({ code: 'ERROR', message: '접근할 수 없습니다.' }, status)));
    await assert.rejects(api.get(7), error => error instanceof ApiError && error.status === status);
  }
  for (const bad of [null, {}, { ...scheduled, id: 0 }, { ...scheduled, applicationId: 0 },
    { ...scheduled, startsAt: 'tomorrow' }, { ...scheduled, timeZone: 'Wrong/Zone' },
    { ...scheduled, status: 'CANCELLED' }, { ...scheduled, title: '' }]) {
    await assert.rejects(createInterviewsApi(async () => bad).get(7), { code: 'INVALID_RESPONSE' });
  }
  await assert.rejects(createInterviewsApi(async () => ({ items: [scheduled, scheduled], page: 0, size: 20, totalElements: 2 })).list(), { code: 'INVALID_RESPONSE' });
  await assert.rejects(createInterviewsApi(async () => { throw new Error('unexpected request'); }).get(0), TypeError);
});

test('stored interview time is displayed in its IANA zone, including across device zones', () => {
  assert.equal(zonedLocalInput('2026-10-15T10:00:00+09:00', 'Asia/Seoul'), '2026-10-15T10:00');
  assert.equal(zonedLocalInput('2026-10-15T10:00:00+09:00', 'America/New_York'), '2026-10-14T21:00');
  assert.match(scheduleLabel(input.startsAt, input.timeZone), /Asia\/Seoul/);
  assert.throws(() => scheduleFromLocal('not-a-date'));
});
