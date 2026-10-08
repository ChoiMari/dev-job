import assert from 'node:assert/strict';
import test from 'node:test';
import { createSkillsApi } from '../src/api/skills.ts';
import { ApiError, createApiClient } from '../src/api/client.ts';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

test('skill add -> list -> delete uses cookie session and fresh CSRF without retry', async () => {
  let owned = []; let tokens = 0; const calls = [];
  const canonical = { id: 1, name: 'PostgreSQL' };
  const ownedSkill = { ...canonical, proficiencyLevel: null, experienceMonths: null };
  const api = createSkillsApi(createApiClient('/api', async (url, options) => {
    calls.push([url, options.method]); assert.equal(options.credentials, 'same-origin');
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: `t${++tokens}` });
    if (options.method === 'POST' || options.method === 'DELETE') assert.equal(options.headers['X-CSRF-TOKEN'], `t${tokens}`);
    if (options.method === 'POST') { assert.deepEqual(JSON.parse(options.body), { name: 'Postgres' }); owned = [ownedSkill]; return json(canonical, 201); }
    if (options.method === 'DELETE') { owned = []; return new Response(null, { status: 204 }); }
    return json({ items: owned });
  }));
  assert.deepEqual(await api.add({ name: 'Postgres' }), canonical);
  assert.deepEqual(await api.list(), [ownedSkill]);
  await api.remove(1); assert.deepEqual(await api.list(), []); assert.equal(tokens, 2); assert.equal(calls.length, 6);
});

test('experience PATCH keeps numeric API values and validates the owned response', async () => {
  let tokens = 0;
  const api = createSkillsApi(createApiClient('/api', async (url, options) => {
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: `t${++tokens}` });
    assert.equal(url, '/api/me/skills/1/experience');
    assert.equal(options.method, 'PATCH');
    assert.equal(options.headers['X-CSRF-TOKEN'], `t${tokens}`);
    assert.deepEqual(JSON.parse(options.body), { proficiencyLevel: 3, experienceMonths: 0 });
    return json({ id: 1, name: 'Java', proficiencyLevel: 3, experienceMonths: 0 });
  }));
  assert.deepEqual(await api.updateExperience(1, { proficiencyLevel: 3, experienceMonths: 0 }),
    { id: 1, name: 'Java', proficiencyLevel: 3, experienceMonths: 0 });
  assert.equal(tokens, 1);
});
test('search encodes alias and pagination and preserves cancellation', async () => {
  const controller = new AbortController();
  const api = createSkillsApi(createApiClient('/api', async (url, options) => {
    assert.equal(url, '/api/skills?q=C%2B%2B&page=1&size=20'); assert.equal(options.signal, controller.signal);
    return json({ items: [{ id: 2, name: 'C++' }], page: 1, size: 20, totalElements: 21 });
  }));
  assert.equal((await api.search('C++', 1, controller.signal)).items[0].name, 'C++');
});
test('invalid skill, list, page and CSRF responses are rejected', async () => {
  for (const value of [null, {}, { items: [{ id: 0, name: 'Java' }] }, { items: [{ id: 1, name: '' }] },
    { items: [{ id: 1, name: 'Java' }] },
    { items: [{ id: 1, name: 'Java', proficiencyLevel: 0, experienceMonths: null }] },
    { items: [{ id: 1, name: 'Java', proficiencyLevel: null, experienceMonths: 601 }] },
    { items: [{ id: 1, name: 'Java', proficiencyLevel: null, experienceMonths: null },
      { id: 1, name: 'Java', proficiencyLevel: null, experienceMonths: null }] }]) {
    await assert.rejects(createSkillsApi(async () => value).list(), { code: 'INVALID_RESPONSE' });
  }
  await assert.rejects(createSkillsApi(async () => ({ items: [], page: 0, size: 20, totalElements: -1 })).search(''), { code: 'INVALID_RESPONSE' });
  let calls = 0;
  await assert.rejects(createSkillsApi(async () => { calls++; return { token: 'bad' }; }).add({ skillId: 1 }), { code: 'INVALID_RESPONSE' });
  assert.equal(calls, 1);
  await assert.rejects(createSkillsApi(async () => ({})).updateExperience(1, {}), TypeError);
  await assert.rejects(createSkillsApi(async () => ({})).updateExperience(1, { proficiencyLevel: 6 }), TypeError);
});
test('duplicate, missing, unauthorized, CSRF and network failures propagate without retry', async () => {
  for (const status of [0, 401, 403, 404, 409]) {
    let calls = 0; const failure = new ApiError('failure', status, 'TEST');
    const api = createSkillsApi(async path => {
      calls++; if (path === '/auth/csrf') return { headerName: 'X-CSRF-TOKEN', token: 'valid' }; throw failure;
    });
    await assert.rejects(api.add({ skillId: 1 }), error => error === failure); assert.equal(calls, 2);
  }
});
