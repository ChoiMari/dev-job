import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';
import type { Skill } from './analysis.ts';

export type SkillDemand = { skill: Skill; jobCount: number; analyzedJobCount: number; ratio: number };
export type SkillDemandPage = { items: SkillDemand[]; page: number; size: number; totalElements: number; analyzedJobCount: number };
export type SkillDemandFilters = { dateFrom?: string; dateTo?: string; desiredRole?: string; page?: number; size?: number };
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function isSkillDemandPage(value: unknown): value is SkillDemandPage {
  if (!object(value) || !count(value.page) || !count(value.size) || value.size < 1 || value.size > 100
    || !count(value.totalElements) || !count(value.analyzedJobCount) || !Array.isArray(value.items)) return false;
  const analyzed = value.analyzedJobCount;
  return value.items.every(item => object(item) && object(item.skill) && count(item.skill.id) && item.skill.id > 0
      && typeof item.skill.name === 'string' && item.skill.name.length > 0 && count(item.jobCount)
      && item.jobCount <= analyzed && item.analyzedJobCount === analyzed
      && typeof item.ratio === 'number' && Number.isFinite(item.ratio) && item.ratio >= 0 && item.ratio <= 1);
}
export function createAnalyticsApi(request: ReturnType<typeof createApiClient>) {
  return {
    async skills(filters: SkillDemandFilters, signal?: AbortSignal): Promise<SkillDemandPage> {
      const value = await request('/analytics/skills', { query: filters, signal });
      if (!isSkillDemandPage(value)) throw new ApiError('시장 기술 수요 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
      return value;
    },
  };
}
