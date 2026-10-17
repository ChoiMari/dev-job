import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';
import type { Skill } from './analysis.ts';

export type SkillGapItem = { skill: Skill; demandJobCount: number; requiredJobCount: number;
  preferredJobCount: number; demandRatio: number; priorityScore: number };
export type SkillGap = { available: boolean; desiredRole: string | null; analyzedJobCount: number;
  provisional: boolean; totalMissingSkills: number; items: SkillGapItem[]; reason: string | null };
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function isSkillGap(value: unknown): value is SkillGap {
  if (!object(value)) return false;
  const analyzed = value.analyzedJobCount;
  if (typeof value.available !== 'boolean' || !count(analyzed)
    || typeof value.provisional !== 'boolean' || !count(value.totalMissingSkills)
    || !(value.desiredRole === null || typeof value.desiredRole === 'string')
    || !(value.reason === null || typeof value.reason === 'string')
    || !Array.isArray(value.items) || value.items.length > 5 || value.totalMissingSkills < value.items.length) return false;
  if (!value.available && (value.items.length !== 0 || value.totalMissingSkills !== 0 || value.provisional || !value.reason)) return false;
  if (value.available && (value.reason !== null || analyzed < 1
    || value.provisional !== (analyzed < 10))) return false;
  return value.items.every(item => object(item) && object(item.skill) && count(item.skill.id) && item.skill.id > 0
    && typeof item.skill.name === 'string' && item.skill.name.length > 0
    && count(item.demandJobCount) && count(item.requiredJobCount) && count(item.preferredJobCount)
    && item.requiredJobCount + item.preferredJobCount === item.demandJobCount
    && item.demandJobCount <= analyzed
    && typeof item.demandRatio === 'number' && Number.isFinite(item.demandRatio)
    && Math.abs(item.demandRatio - item.demandJobCount / analyzed) < 1e-9
    && typeof item.priorityScore === 'number' && Number.isFinite(item.priorityScore)
    && Math.abs(item.priorityScore - 100 * (item.requiredJobCount + 0.5 * item.preferredJobCount)
      / analyzed) < 1e-9);
}
export function createSkillGapApi(request: ReturnType<typeof createApiClient>) {
  return {
    async get(desiredRole?: string, signal?: AbortSignal): Promise<SkillGap> {
      const value = await request('/me/skill-gap', { query: { desiredRole }, signal });
      if (!isSkillGap(value)) throw new ApiError('역량 분석 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
      return value;
    },
  };
}
