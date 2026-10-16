import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiClient } from '../src/api/client.ts';
import { createDocumentApi } from '../src/api/documents.ts';
import { createResumeDraftApi } from '../src/api/resume-draft.ts';

const updatedAt = '2026-10-16T00:00:00Z';
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('drafts list, create and update use separate ids without sending response metadata', async () => {
  const calls = [];
  const api = createResumeDraftApi(createApiClient('/api', async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/auth/csrf') return response({ headerName: 'X-CSRF-TOKEN', token: 'csrf' });
    if (options.method === 'GET') return response([{ id: 3, title: '초안', mode: 'free', updatedAt }]);
    return response({ id: options.method === 'POST' ? 4 : 3, title: '초안', mode: 'free', updatedAt }, options.method === 'POST' ? 201 : 200);
  }));
  const draft = { version: 1, mode: 'free', title: '초안', content: '본문', form: {} };
  assert.equal((await api.list())[0].id, 3);
  assert.equal((await api.save(draft)).id, 4);
  assert.equal((await api.save(draft, 3)).id, 3);
  assert.deepEqual(calls.filter(call => call.options.method !== 'GET').map(call => [call.url, call.options.method, JSON.parse(call.options.body)]), [
    ['/api/me/resumes/drafts', 'POST', draft],
    ['/api/me/resumes/drafts/3', 'PUT', draft],
  ]);
});

test('final resume creation identifies only the selected draft', async () => {
  let body;
  const api = createDocumentApi(createApiClient('/api', async (url, options) => {
    if (url === '/api/auth/csrf') return response({ headerName: 'X-CSRF-TOKEN', token: 'csrf' });
    body = JSON.parse(options.body);
    return response({ id: 2, title: '이력서', latestVersionId: 7, latestVersionNumber: 1,
      latestVersionCreatedAt: updatedAt, createdAt: updatedAt, updatedAt }, 201);
  }), 'RESUME');
  await api.create('이력서', '본문', 3);
  assert.deepEqual(body, { title: '이력서', content: '본문', draftId: 3 });
});

test('version draft summaries keep their target and version writes consume the selected draft', async () => {
  const calls = [];
  const request = createApiClient('/api', async (url, options) => {
    if (url === '/api/auth/csrf') return response({ headerName: 'X-CSRF-TOKEN', token: 'csrf' });
    calls.push({ url, method: options.method, body: options.body && JSON.parse(options.body) });
    if (options.method === 'GET') return response([
      { id: 8, title: '새 버전', mode: 'free', purpose: 'version-new', resumeId: 5, updatedAt },
      { id: 9, title: '수정 중', mode: 'template', purpose: 'version-edit', resumeId: 5, versionId: 2, updatedAt },
    ]);
    return response({ id: options.method === 'POST' ? 3 : 2, resumeId: 5, versionNumber: 2, createdAt: updatedAt }, options.method === 'POST' ? 201 : 200);
  });
  const drafts = createResumeDraftApi(request);
  const documents = createDocumentApi(request, 'RESUME');
  assert.deepEqual((await drafts.list()).map(item => item.purpose), ['version-new', 'version-edit']);
  await documents.addVersion(5, '새 원문', { title: '새 버전', draftId: 8 });
  await documents.editVersion(5, 2, '수정 원문', { title: '수정 중', draftId: 9 });
  assert.deepEqual(calls.filter(call => call.method !== 'GET').map(call => call.body.draftId), [8, 9]);
});
