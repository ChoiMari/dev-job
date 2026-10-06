import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';
import type { Skill } from './analysis.ts';

export type SkillGroup = { matched: Skill[]; missing: Skill[]; total: number };
export type JobMatch = { available: boolean; required: SkillGroup; preferred: SkillGroup;
  matchRate: number | null; reason: 'NO_JOB_SKILLS' | 'USER_SKILLS_EMPTY' | null };
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const skill = (value: unknown): value is Skill => object(value) && Number.isSafeInteger(value.id) && Number(value.id) > 0
  && typeof value.name === 'string';
const group = (value: unknown): value is SkillGroup => object(value) && Array.isArray(value.matched)
  && value.matched.every(skill) && Array.isArray(value.missing) && value.missing.every(skill)
  && Number.isSafeInteger(value.total) && Number(value.total) === value.matched.length + value.missing.length;
export function isJobMatch(value: unknown): value is JobMatch {
  return object(value) && typeof value.available === 'boolean' && group(value.required) && group(value.preferred)
    && (value.matchRate === null || (Number.isSafeInteger(value.matchRate) && Number(value.matchRate) >= 0 && Number(value.matchRate) <= 100))
    && (value.reason === null || value.reason === 'NO_JOB_SKILLS' || value.reason === 'USER_SKILLS_EMPTY')
    && (value.available ? value.matchRate !== null && value.reason === null
      : value.matchRate === null && value.required.total === 0 && value.preferred.total === 0 && value.reason !== null);
}
export function createMatchApi(request: ReturnType<typeof createApiClient>) {
  return {
    async get(jobId: number, signal?: AbortSignal): Promise<JobMatch> {
      if (!Number.isSafeInteger(jobId) || jobId < 1) throw new ApiError('공고 주소를 확인해 주세요.', 400, 'INVALID_INPUT');
      const value = await request(`/jobs/${jobId}/match`, { signal });
      if (!isJobMatch(value)) throw new ApiError('역량 비교 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
      return value;
    },
  };
}
