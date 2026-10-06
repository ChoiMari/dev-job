import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalyticsApi } from '../src/api/analytics.ts';
import { createApiClient } from '../src/api/client.ts';

const page = { items: [{ skill: { id: 1, name: 'Java' }, jobCount: 2, analyzedJobCount: 4, ratio: 0.5 }],
  page: 0, size: 20, totalElements: 1, analyzedJobCount: 4 };
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('market filters and cancellation reach the API', async () => {
  const controller = new AbortController();
  const api = createAnalyticsApi(createApiClient('/api', async (path, options) => {
    const query = new URL('http://localhost' + path).searchParams;
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.signal, controller.signal);
    assert.equal(query.get('dateFrom'), '2026-10-01');
    assert.equal(query.get('desiredRole'), '백엔드 & API');
    assert.equal(query.get('page'), '0');
    return json(page);
  }));
  assert.deepEqual(await api.skills({ dateFrom: '2026-10-01', desiredRole: '백엔드 & API', page: 0 }, controller.signal), page);
});

test('empty market result is valid and malformed counts are rejected', async () => {
  const empty = { items: [], page: 0, size: 20, totalElements: 0, analyzedJobCount: 0 };
  assert.deepEqual(await createAnalyticsApi(async () => empty).skills({}), empty);
  for (const value of [{ ...page, analyzedJobCount: 1 }, { ...page, items: [{ ...page.items[0], ratio: 2 }] },
    { ...page, items: [{ ...page.items[0], skill: { id: 0, name: 'Java' } }] }]) {
    await assert.rejects(createAnalyticsApi(async () => value).skills({}), { code: 'INVALID_RESPONSE' });
  }
});
