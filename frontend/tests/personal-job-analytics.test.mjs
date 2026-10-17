import assert from 'node:assert/strict';
import test from 'node:test';
import { createPersonalJobAnalyticsApi } from '../src/api/personal-job-analytics.ts';

const result = { savedJobCount: 6, analyzedJobCount: 2, skills: [
  { name: 'Spring Boot', jobCount: 2, requiredJobCount: 1, preferredJobCount: 1, ratio: 1 },
  { name: 'PrivateTool', jobCount: 1, requiredJobCount: 1, preferredJobCount: 0, ratio: .5 },
] };

test('personal job analytics accepts owned-sample counts and custom extracted skill names', async () => {
  const api = createPersonalJobAnalyticsApi(async (path) => {
    assert.equal(path, '/me/job-analytics');
    return result;
  });
  assert.deepEqual(await api.get(), result);
  for (const invalid of [
    { ...result, analyzedJobCount: 7 },
    { ...result, skills: [{ ...result.skills[0], jobCount: 3 }] },
    { ...result, skills: [result.skills[0], { ...result.skills[0], name: 'spring boot' }] },
  ]) await assert.rejects(createPersonalJobAnalyticsApi(async () => invalid).get(), { code: 'INVALID_RESPONSE' });
});
