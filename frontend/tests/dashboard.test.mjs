import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardApi } from '../src/api/dashboard.ts';
import { createApiClient } from '../src/api/client.ts';

const statuses = ['INTERESTED', 'PLANNED', 'APPLIED', 'DOCUMENT_PASSED', 'INTERVIEW', 'FINAL_PASSED', 'REJECTED', 'WITHDRAWN'];
const counts = Object.fromEntries(statuses.map(status => [status, 0]));
const empty = { applicationCounts: counts, bookmarkCount: 0, nextActions: [], recommendedJobs: [], skillGapPreview: [], personalTodos: [] };

test('dashboard fetches authenticated summary and accepts empty data', async () => {
  const signal = new AbortController().signal;
  const api = createDashboardApi(createApiClient('/api', async (path, options) => {
    assert.equal(path, '/api/dashboard');
    assert.equal(options.signal, signal);
    assert.equal(options.credentials, 'same-origin');
    return new Response(JSON.stringify(empty), { headers: { 'content-type': 'application/json' } });
  }));
  assert.deepEqual(await api.get(signal), empty);
});

test('dashboard checks counts, actions, recommendations and skills', async () => {
  const valid = { ...empty, nextActions: [{ applicationId: 2, jobId: 3, jobTitle: '개발자', status: 'PLANNED', nextScheduleAt: null }],
    skillGapPreview: [{ id: 1, name: 'Java' }] };
  assert.deepEqual(await createDashboardApi(async () => valid).get(), valid);
  for (const invalid of [{ ...empty, applicationCounts: { PLANNED: 1 } },
    { ...valid, nextActions: [{ ...valid.nextActions[0], status: 'UNKNOWN' }] },
    { ...valid, skillGapPreview: [{ id: -1, name: 'Java' }] },
    { ...valid, recommendedJobs: [{}] }, { ...valid, personalTodos: [{}] },
    { ...valid, personalTodos: [{ id: 1, title: '완료', description: null, dueAt: null, dueTimeZone: null,
      completed: true, completedAt: '2026-10-08T00:00:00Z', createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z' }] }]) {
    await assert.rejects(createDashboardApi(async () => invalid).get(), { code: 'INVALID_RESPONSE' });
  }
});
