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

test('distribution keeps unknown values in the denominator and accepts an empty sample', async () => {
  const distribution = { jobCount: 5, insufficientSample: true, buckets: [
    { key: 'ENTRY', jobCount: 2, ratio: 0.4 }, { key: 'UNKNOWN', jobCount: 3, ratio: 0.6 },
  ] };
  const seen = [];
  const api = createAnalyticsApi(async (path, options) => { seen.push([path, options.query]); return distribution; });
  assert.deepEqual(await api.careerLevels({ source: 'ALIO', dateFrom: '2026-10-01' }), distribution);
  assert.deepEqual(await api.locations({ desiredRole: '개발' }), distribution);
  assert.equal(seen[0][0], '/analytics/career-levels');
  assert.equal(seen[0][1].source, 'ALIO');
  assert.equal(seen[1][0], '/analytics/locations');
  assert.deepEqual(await createAnalyticsApi(async () => ({ jobCount: 0, insufficientSample: true, buckets: [] })).careerLevels({}),
    { jobCount: 0, insufficientSample: true, buckets: [] });
  await assert.rejects(createAnalyticsApi(async () => ({ ...distribution, buckets: distribution.buckets.slice(0, 1) })).locations({}), { code: 'INVALID_RESPONSE' });
});

test('trend distinguishes empty periods from zero percent and validates sample flags', async () => {
  const trend = { skillId: 7, interval: 'MONTH', periods: [
    { periodStart: '2026-10-01', analyzedJobCount: 3, jobCount: 2, ratio: 0.6667, insufficientSample: true },
    { periodStart: '2026-11-01', analyzedJobCount: 0, jobCount: 0, ratio: null, insufficientSample: true },
  ] };
  const filters = { skillId: 7, dateFrom: '2026-10-10', dateTo: '2026-11-10', interval: 'MONTH' };
  const api = createAnalyticsApi(async (path, options) => {
    assert.equal(path, '/analytics/skills/trends'); assert.equal(options.query.dateFrom, filters.dateFrom); return trend;
  });
  assert.deepEqual(await api.trend(filters), trend);
  for (const bad of [
    { ...trend, periods: [{ ...trend.periods[1], ratio: 0 }] },
    { ...trend, periods: [{ ...trend.periods[0], insufficientSample: false }] },
  ]) await assert.rejects(createAnalyticsApi(async () => bad).trend(filters), { code: 'INVALID_RESPONSE' });
});
