import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type PersonalJobSkillDemand = { name: string; jobCount: number; requiredJobCount: number;
  preferredJobCount: number; ratio: number };
export type PersonalJobAnalytics = { savedJobCount: number; analyzedJobCount: number;
  skills: PersonalJobSkillDemand[] };

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function isPersonalJobAnalytics(value: unknown): value is PersonalJobAnalytics {
  if (!object(value)) return false;
  const analyzed = value.analyzedJobCount;
  if (!count(value.savedJobCount) || !count(analyzed)
    || analyzed > value.savedJobCount || !Array.isArray(value.skills)) return false;
  const names = new Set<string>();
  return value.skills.every(item => {
    if (!object(item) || typeof item.name !== 'string' || !item.name.trim()
      || names.has(item.name.toLocaleLowerCase()) || !count(item.jobCount)
      || !count(item.requiredJobCount) || !count(item.preferredJobCount)
      || item.jobCount !== item.requiredJobCount + item.preferredJobCount
      || item.jobCount < 1 || item.jobCount > analyzed
      || typeof item.ratio !== 'number' || !Number.isFinite(item.ratio)
      || Math.abs(item.ratio - item.jobCount / analyzed) > 1e-9) return false;
    names.add(item.name.toLocaleLowerCase());
    return true;
  });
}

export function createPersonalJobAnalyticsApi(request: ReturnType<typeof createApiClient>) {
  return {
    async get(signal?: AbortSignal): Promise<PersonalJobAnalytics> {
      const value = await request('/me/job-analytics', { signal });
      if (!isPersonalJobAnalytics(value))
        throw new ApiError('내 공고 분석 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
      return value;
    },
  };
}
