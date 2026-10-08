import assert from 'node:assert/strict';
import test from 'node:test';
import { companyLink, createCompaniesApi } from '../src/api/companies.ts';
import { ApiError, createApiClient } from '../src/api/client.ts';

const input = { name: '동명기업', websiteUrl: 'https://example.com', note: '관심 기업', status: 'INTERESTED' };
const value = { ...input, id: 3, createdAt: '2026-10-08T01:00:00Z', updatedAt: '2026-10-08T01:00:00Z' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('company CRUD uses current session, fresh CSRF, and the separate personal resource', async () => {
  let stored; let tokens = 0;
  const api = createCompaniesApi(createApiClient('/api', async (url, options) => {
    assert.equal(options.credentials, 'same-origin');
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 't' + ++tokens });
    if (options.method !== 'GET') assert.equal(options.headers['X-CSRF-TOKEN'], 't' + tokens);
    if (options.method === 'POST') {
      assert.equal(url, '/api/me/companies'); assert.deepEqual(JSON.parse(options.body), input);
      stored = value; return json(stored, 201);
    }
    if (options.method === 'PATCH') {
      assert.equal(url, '/api/me/companies/3');
      assert.deepEqual(JSON.parse(options.body), { ...input, note: null, status: 'RESEARCHING' });
      stored = { ...stored, note: null, status: 'RESEARCHING' }; return json(stored);
    }
    if (options.method === 'DELETE') {
      assert.equal(url, '/api/me/companies/3'); stored = undefined; return new Response(null, { status: 204 });
    }
    return url.includes('?') ? json({ items: stored ? [stored] : [], page: 0, size: 20, totalElements: stored ? 1 : 0 }) : json(stored);
  }));
  assert.equal((await api.create(input)).id, 3);
  assert.equal((await api.get(3)).name, '동명기업');
  assert.equal((await api.list()).items.length, 1);
  assert.equal((await api.update(3, { ...input, note: null, status: 'RESEARCHING' })).note, null);
  await api.remove(3);
  assert.deepEqual((await api.list()).items, []);
  assert.equal(tokens, 3);
});

test('page and abort signal follow the contract', async () => {
  const controller = new AbortController();
  const api = createCompaniesApi(createApiClient('/api', async (url, options) => {
    assert.equal(url, '/api/me/companies?page=1&size=20');
    assert.equal(options.signal, controller.signal);
    return json({ items: [], page: 1, size: 20, totalElements: 20 });
  }));
  assert.equal((await api.list(1, controller.signal)).page, 1);
});

test('invalid company responses and unsafe website links are rejected', async () => {
  for (const bad of [null, {}, { ...value, id: 0 }, { ...value, status: 'UNKNOWN' },
    { ...value, name: '' }, { ...value, websiteUrl: 'javascript:alert(1)' },
    { ...value, note: 123 }, { ...value, updatedAt: 'bad' }]) {
    await assert.rejects(createCompaniesApi(async () => bad).get(3), { code: 'INVALID_RESPONSE' });
  }
  for (const bad of [{ items: [value, value], page: 0, size: 20, totalElements: 2 },
    { items: [], page: 0, size: 20, totalElements: -1 }, { items: [], page: 1, size: 20, totalElements: 0 }]) {
    await assert.rejects(createCompaniesApi(async () => bad).list(), { code: 'INVALID_RESPONSE' });
  }
  assert.equal(companyLink('https://example.com'), 'https://example.com');
  for (const url of ['javascript:alert(1)', 'https://user:password@example.com', 'https://example.com/#bad', '/relative', null])
    assert.equal(companyLink(url), undefined);
  await assert.rejects(createCompaniesApi(async () => { throw new Error('must not request'); }).get(0), TypeError);
});

test('conflict and network errors propagate without duplicate requests', async () => {
  let calls = 0;
  await assert.rejects(createCompaniesApi(async () => { calls++; return { token: 'bad' }; }).create(input), { code: 'INVALID_RESPONSE' });
  assert.equal(calls, 1);
  calls = 0;
  const conflict = new ApiError('duplicate', 409, 'CONFLICT');
  await assert.rejects(createCompaniesApi(async path => {
    calls++; if (path === '/auth/csrf') return { headerName: 'X-CSRF-TOKEN', token: 'valid' };
    throw conflict;
  }).create(input), error => error === conflict);
  assert.equal(calls, 2);
});
