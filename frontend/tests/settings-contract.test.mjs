import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/api/client.ts';
import { createNotificationPreferencesApi } from '../src/api/notification-preferences.ts';
import { createAccountDeletionApi } from '../src/api/account-deletion.ts';

const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('A19 preferences sends both booleans with CSRF and uses saved response', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/csrf')) return json({ headerName: 'X-CSRF-TOKEN', token: 'csrf-test' });
    if (options.method === 'PUT') return json({ interviewReminder: false, todoReminder: true });
    return json({ interviewReminder: true, todoReminder: true });
  };
  const api = createNotificationPreferencesApi(createApiClient('/api', fetcher));
  assert.deepEqual(await api.get(), { interviewReminder: true, todoReminder: true });
  assert.deepEqual(await api.save({ interviewReminder: false, todoReminder: true }),
    { interviewReminder: false, todoReminder: true });
  assert.equal(calls[2].url, '/api/me/notification-preferences');
  assert.equal(calls[2].options.headers['X-CSRF-TOKEN'], 'csrf-test');
  assert.deepEqual(JSON.parse(calls[2].options.body), { interviewReminder: false, todoReminder: true });
  await assert.rejects(createNotificationPreferencesApi(async () => ({ interviewReminder: 'yes', todoReminder: true })).get(),
    { code: 'INVALID_RESPONSE' });
});

test('A21 impact keeps server counts and deletion sends exact confirmation with CSRF', async () => {
  const impact = { deletedResources: [{ code: 'resume', name: '이력서', count: 2 }],
    preservedSharedResources: ['공용 공고'], confirmationText: '계정 삭제',
    recoverableInApp: false, processing: '동기 처리', externalDataNotice: '백업 별도' };
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/deletion-impact')) return json(impact);
    if (url.endsWith('/csrf')) return json({ headerName: 'X-CSRF-TOKEN', token: 'csrf-test' });
    return new Response(null, { status: 204 });
  };
  const api = createAccountDeletionApi(createApiClient('/api', fetcher));
  assert.deepEqual(await api.impact(), impact);
  await api.delete('password123', '계정 삭제');
  assert.equal(calls[2].options.method, 'DELETE');
  assert.equal(calls[2].options.headers['X-CSRF-TOKEN'], 'csrf-test');
  assert.deepEqual(JSON.parse(calls[2].options.body), { currentPassword: 'password123', confirmation: '계정 삭제' });
  await assert.rejects(createAccountDeletionApi(async () => ({ ...impact, deletedResources: [{ count: -1 }] })).impact(),
    { code: 'INVALID_RESPONSE' });
});

test('A21 failed deletion does not claim a 204 or discard server error', async () => {
  const api = createAccountDeletionApi(createApiClient('/api', async (url) => url.endsWith('/csrf')
    ? json({ headerName: 'X-CSRF-TOKEN', token: 'csrf-test' })
    : new Response(JSON.stringify({ code: 'UNAUTHORIZED', message: '재인증 실패' }),
      { status: 401, headers: { 'content-type': 'application/json' } })));
  await assert.rejects(api.delete('wrong-password', '계정 삭제'), { status: 401 });
});
