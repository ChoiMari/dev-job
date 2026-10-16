import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiClient } from '../src/api/client.ts';
import { createDocumentApi } from '../src/api/documents.ts';

const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const summary = { id: 2, title: '문서', latestVersionId: 7, latestVersionNumber: 1, latestVersionCreatedAt: '2026-10-09T10:00:00Z', createdAt: '2026-10-09T10:00:00Z', updatedAt: '2026-10-09T10:00:00Z' };
const selection = { documentType: 'RESUME', documentId: 2, versionId: 7 };
const analysis = { id: 4, status: 'PENDING', source: { ...selection, versionNumber: 1, createdAt: summary.createdAt }, stale: false, result: null, failureReason: null, consentedAt: summary.createdAt, analyzedAt: null, updatedAt: summary.createdAt };

test('version metadata omits content and detail fetches selected original', async () => {
  const calls = [];
  const api = createDocumentApi(createApiClient('/api', async (url, options) => {
    calls.push(url);
    if (url.endsWith('/versions/7')) return json({ id: 7, resumeId: 2, versionNumber: 1, createdAt: summary.createdAt, content: '원문' });
    return json([{ id: 7, resumeId: 2, versionNumber: 1, createdAt: summary.createdAt }]);
  }), 'RESUME');
  assert.equal((await api.versions(2))[0].content, undefined);
  assert.equal((await api.version(2, 7)).content, '원문');
  assert.deepEqual(calls, ['/api/me/resumes/2/versions', '/api/me/resumes/2/versions/7']);
});

test('resume version detail accepts form and edit/delete send CSRF requests', async () => {
  const calls = [];
  const form = { name: '홍길동' };
  const api = createDocumentApi(createApiClient('/api', async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'fresh' });
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    if (options.method === 'PATCH') return json({ id: 7, resumeId: 2, versionNumber: 1, createdAt: summary.createdAt, title: '수정본' });
    return json({ id: 7, resumeId: 2, versionNumber: 1, createdAt: summary.createdAt, content: '원문', form });
  }), 'RESUME');
  assert.deepEqual((await api.version(2, 7)).form, form);
  assert.equal((await api.editVersion(2, 7, '수정 원문', { title: '수정본', form })).title, '수정본');
  assert.deepEqual(JSON.parse(calls.find(call => call.options.method === 'PATCH').options.body), { content: '수정 원문', title: '수정본', form });
  await api.removeVersion(2, 7);
  assert.equal(calls.at(-1).options.method, 'DELETE');
  assert.equal(calls.at(-1).options.headers['X-CSRF-TOKEN'], 'fresh');
});

test('resume version creation sends title and description while keeping content out of metadata', async () => {
  const calls = [];
  const api = createDocumentApi(createApiClient('/api', async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'fresh' });
    return json({ id: 8, resumeId: 2, versionNumber: 2, createdAt: summary.createdAt, title: '지원용 버전', description: '프로젝트 보강' });
  }), 'RESUME');
  const created = await api.addVersion(2, '새 원문', { title: '지원용 버전', description: '프로젝트 보강' });
  assert.equal(created.title, '지원용 버전');
  assert.equal(created.content, undefined);
  assert.deepEqual(JSON.parse(calls[1].options.body), { content: '새 원문', title: '지원용 버전', description: '프로젝트 보강' });
});

test('template resume creation sends its form with the generated source', async () => {
  const calls = [];
  const form = { name: '홍길동' };
  const api = createDocumentApi(createApiClient('/api', async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'fresh' });
    return json({ ...summary, versionCount: 1 });
  }), 'RESUME');
  await api.create('양식 이력서', '이름: 홍길동', undefined, form);
  assert.deepEqual(JSON.parse(calls[1].options.body), { title: '양식 이력서', content: '이름: 홍길동', form });
});

test('analysis POST requires explicit consent and GET reports stale saved result', async () => {
  const calls = [];
  const api = createDocumentApi(createApiClient('/api', async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'fresh' });
    if (options.method === 'POST') return json(analysis);
    return json({ ...analysis, status: 'COMPLETED', stale: true, result: { skills: ['Java'], strengths: [], improvements: [] }, analyzedAt: summary.createdAt });
  }), 'RESUME');
  assert.equal((await api.analyze(selection)).status, 'PENDING');
  assert.deepEqual(JSON.parse(calls[1].options.body), { consentToExternalAnalysis: true });
  assert.equal(calls[1].options.headers['X-CSRF-TOKEN'], 'fresh');
  assert.equal((await api.analysis(selection)).stale, true);
  assert.equal(calls[2].options.method, 'GET');
});

test('cover letter endpoints use coverLetterId and reject wrong document source', async () => {
  const api = createDocumentApi(createApiClient('/api', async url => {
    assert.equal(url, '/api/me/cover-letters/2/versions/7');
    return json({ id: 7, coverLetterId: 2, versionNumber: 1, createdAt: summary.createdAt, content: '원문' });
  }), 'COVER_LETTER');
  assert.equal((await api.version(2, 7)).content, '원문');
  const wrong = createDocumentApi(async () => ({ ...analysis, source: selection }), 'COVER_LETTER');
  await assert.rejects(wrong.analysis({ ...selection, documentType: 'COVER_LETTER' }), { code: 'INVALID_RESPONSE' });
});

test('failed analysis stays saved until an explicit consented retry or deletion', async () => {
  const calls = [];
  const api = createDocumentApi(createApiClient('/api', async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'fresh' });
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    if (options.method === 'POST') return json(analysis);
    return json({ ...analysis, status: 'FAILED', failureReason: '분석 실패' });
  }), 'RESUME');
  assert.equal((await api.analysis(selection)).status, 'FAILED');
  assert.equal(calls.filter(c => c.options.method === 'POST').length, 0);
  assert.equal((await api.analyze(selection)).status, 'PENDING');
  await api.removeAnalysis(selection);
  assert.equal(calls.at(-1).options.method, 'DELETE');
  assert.equal(calls.at(-1).options.headers['X-CSRF-TOKEN'], 'fresh');
});
