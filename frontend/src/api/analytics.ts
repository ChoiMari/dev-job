import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';
import type { Skill } from './analysis.ts';

export type SkillDemand = { skill: Skill; jobCount: number; analyzedJobCount: number; ratio: number };
export type SkillDemandPage = { items: SkillDemand[]; page: number; size: number; totalElements: number; analyzedJobCount: number };
export type SkillDemandFilters = { dateFrom?: string; dateTo?: string; desiredRole?: string; page?: number; size?: number };
export type MarketFilters = Pick<SkillDemandFilters, 'dateFrom' | 'dateTo' | 'desiredRole'> & { source?: string };
export type MarketDistribution = { jobCount: number; insufficientSample: boolean; buckets: { key: string; jobCount: number; ratio: number }[] };
export type SkillTrend = { skillId: number; interval: 'WEEK' | 'MONTH'; periods: { periodStart: string; analyzedJobCount: number; jobCount: number; ratio: number | null; insufficientSample: boolean }[] };
export type TrendFilters = MarketFilters & { skillId: number; dateFrom: string; dateTo: string; interval: 'WEEK' | 'MONTH' };
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const ratio = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
export function isMarketDistribution(value: unknown): value is MarketDistribution {
  if (!object(value) || !count(value.jobCount) || value.insufficientSample !== (value.jobCount < 10) || !Array.isArray(value.buckets)) return false;
  const keys = new Set<string>(); let total = 0;
  for (const bucket of value.buckets) {
    if (!object(bucket) || typeof bucket.key !== 'string' || !bucket.key || keys.has(bucket.key)
      || !count(bucket.jobCount) || bucket.jobCount === 0 || !ratio(bucket.ratio)
      || Math.abs(bucket.ratio - bucket.jobCount / (value.jobCount as number)) > 0.000051) return false;
    keys.add(bucket.key); total += bucket.jobCount;
  }
  return total === value.jobCount;
}
export function isSkillTrend(value: unknown): value is SkillTrend {
  return object(value) && count(value.skillId) && value.skillId > 0
    && (value.interval === 'WEEK' || value.interval === 'MONTH') && Array.isArray(value.periods)
    && value.periods.every(period => object(period) && date(period.periodStart)
      && count(period.analyzedJobCount) && count(period.jobCount) && period.jobCount <= period.analyzedJobCount
      && period.insufficientSample === (period.analyzedJobCount < 10)
      && (period.analyzedJobCount === 0 ? period.ratio === null
        : ratio(period.ratio) && Math.abs(period.ratio - period.jobCount / period.analyzedJobCount) <= 0.000051));
}
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
    async careerLevels(filters: MarketFilters, signal?: AbortSignal): Promise<MarketDistribution> {
      const value = await request('/analytics/career-levels', { query: filters, signal });
      if (!isMarketDistribution(value)) throw new ApiError('경력 분포 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
      return value;
    },
    async locations(filters: MarketFilters, signal?: AbortSignal): Promise<MarketDistribution> {
      const value = await request('/analytics/locations', { query: filters, signal });
      if (!isMarketDistribution(value)) throw new ApiError('지역 분포 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
      return value;
    },
    async trend(filters: TrendFilters, signal?: AbortSignal): Promise<SkillTrend> {
      const value = await request('/analytics/skills/trends', { query: filters, signal });
      if (!isSkillTrend(value) || value.skillId !== filters.skillId || value.interval !== filters.interval)
        throw new ApiError('기술 추이 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
      return value;
    },
  };
}
