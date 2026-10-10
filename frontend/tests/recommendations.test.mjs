import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiClient } from '../src/api/client.ts';
import { createRecommendationsApi, validateRecommendationRequest } from '../src/api/recommendations.ts';

const now = '2026-10-10T03:00:00Z';
const item = { kind: 'COLLECTED', id: 10, title: '공고', status: 'COMPLETED', reason: null, rank: 1,
  evidence: [{ documentQuote: '경험', jobQuote: '업무', explanation: '관련 경험' }], limitations: ['연수 확인 불가'] };
const result = { id: 4, status: 'COMPLETED', stale: false, failureReason: null, consentedAt: now,
  analyzedAt: now, policyVersion: 'B14_V1', modelName: 'model', resumeVersionId: 3,
  coverLetterVersionId: null, candidateCount: 1, items: [item], page: 0, size: 20,
  totalElements: 1, limitation: '입력 원문이 잘릴 수 있습니다.' };
const input = candidates => ({ resumeVersionId: 3, coverLetterVersionId: null,
  candidates, consentToExternalComparison: true });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('0 and 20 explicit candidates are valid; 21, duplicates and missing documents or consent are rejected before network', () => {
  assert.doesNotThrow(() => validateRecommendationRequest(input([])));
  const twenty = Array.from({ length: 20 }, (_, i) => ({ kind: i % 2 ? 'MANUAL' : 'COLLECTED', id: i + 1 }));
  assert.doesNotThrow(() => validateRecommendationRequest(input(twenty)));
  assert.throws(() => validateRecommendationRequest(input([...twenty, { kind: 'MANUAL', id: 21 }])), /최대 20개/);
  assert.throws(() => validateRecommendationRequest(input([twenty[0], twenty[0]])), /중복/);
  assert.throws(() => validateRecommendationRequest({ ...input([]), resumeVersionId: null }), /하나 이상/);
  assert.throws(() => validateRecommendationRequest({ ...input([]), consentToExternalComparison: false }), /동의/);
});

test('POST sends exact kind and ID, selected version IDs and consent, then GET reads stored result', async () => {
  const calls = [];
  const api = createRecommendationsApi(createApiClient('/api', async (url, options) => {
    calls.push({ url, options });
    return url === '/api/auth/csrf' ? json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' }) : json(result);
  }));
  const request = { resumeVersionId: 3, coverLetterVersionId: 7,
    candidates: [{ kind: 'COLLECTED', id: 10 }, { kind: 'MANUAL', id: 10 }], consentToExternalComparison: true };
  await api.create(request);
  await api.get(4);
  assert.deepEqual(JSON.parse(calls[1].options.body), request);
  assert.equal(calls[1].options.headers['X-CSRF-TOKEN'], 'csrf');
  assert.equal(calls[2].url, '/api/me/recommendations/jobs?requestId=4&page=0&size=20');
  assert.equal(calls[2].options.method, 'GET');
});

test('empty and maximum-size selections reach POST unchanged', async () => {
  const sent = [];
  const api = createRecommendationsApi(createApiClient('/api', async (url, options) => {
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' });
    sent.push(JSON.parse(options.body));
    return json({ ...result, candidateCount: sent.at(-1).candidates.length, items: [], totalElements: 0 });
  }));
  const twenty = Array.from({ length: 20 }, (_, i) => ({ kind: 'COLLECTED', id: i + 1 }));
  await api.create(input([]));
  await api.create(input(twenty));
  assert.deepEqual(sent.map(v => v.candidates.length), [0, 20]);
  assert.deepEqual(sent[1].candidates, twenty);
});

test('saved PENDING, FAILED, excluded, insufficient input, evidence, limitation and stale fields survive GET', async () => {
  const states = [
    { ...result, status: 'PENDING', analyzedAt: null, items: [{ ...item, status: 'PENDING', rank: null, evidence: [] }] },
    { ...result, status: 'FAILED', failureReason: '비교 실패', items: [{ ...item, status: 'FAILED', rank: null, evidence: [] }] },
    { ...result, stale: true, candidateCount: 2, totalElements: 2, items: [
      { ...item, status: 'EXCLUDED', reason: 'ALREADY_APPLIED', rank: null, evidence: [] },
      { ...item, id: 11, status: 'INSUFFICIENT_INPUT', reason: 'INSUFFICIENT_INPUT', rank: null, evidence: [] },
    ] },
  ];
  for (const state of states) {
    const api = createRecommendationsApi(createApiClient('/api', async () => json(state)));
    assert.deepEqual(await api.get(4), state);
  }
});

test('404 and 503 remain distinguishable, and malformed stored data is rejected', async () => {
  for (const status of [404, 503]) {
    const api = createRecommendationsApi(createApiClient('/api', async url => url.endsWith('/auth/csrf')
      ? json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' }) : json({ code: 'ERROR', message: '실패' }, status)));
    await assert.rejects(api.get(4), { status });
    await assert.rejects(api.create(input([])), { status });
  }
  const api = createRecommendationsApi(async () => ({ ...result, items: [{ ...item, rank: '1' }] }));
  await assert.rejects(api.get(4), { code: 'INVALID_RESPONSE' });
});
