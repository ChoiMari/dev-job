import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkillGapApi } from '../src/api/skill-gap.ts';
import { createApiClient } from '../src/api/client.ts';

const result = { available: true, desiredRole: '백엔드', analyzedJobCount: 5, provisional: true,
  totalMissingSkills: 1, reason: null, items: [{ skill: { id: 1, name: 'Docker' },
    demandJobCount: 4, requiredJobCount: 2, preferredJobCount: 2, demandRatio: 0.8, priorityScore: 60 }] };
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('skill gap sends role filter and cancellation', async () => {
  const controller = new AbortController();
  const api = createSkillGapApi(createApiClient('/api', async (path, options) => {
    assert.equal(new URL('http://localhost' + path).searchParams.get('desiredRole'), '백엔드');
    assert.equal(options.signal, controller.signal);
    assert.equal(options.credentials, 'same-origin');
    return json(result);
  }));
  assert.deepEqual(await api.get('백엔드', controller.signal), result);
});

test('skill gap validates score inputs and unavailable responses', async () => {
  const empty = { available: false, desiredRole: null, analyzedJobCount: 4,
    provisional: false, totalMissingSkills: 0, items: [], reason: 'INSUFFICIENT_SAMPLE' };
  assert.deepEqual(await createSkillGapApi(async () => empty).get(), empty);
  for (const invalid of [{ ...result, items: [{ ...result.items[0], priorityScore: 80 }] },
    { ...result, items: [{ ...result.items[0], demandJobCount: 3 }] },
    { ...empty, items: result.items }, { ...result, provisional: false }]) {
    await assert.rejects(createSkillGapApi(async () => invalid).get(), { code: 'INVALID_RESPONSE' });
  }
});
