import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type Skill = { id: number; name: string };
export type OwnedSkill = Skill & { proficiencyLevel: number | null; experienceMonths: number | null };
export type SkillExperiencePatch = { proficiencyLevel?: number | null; experienceMonths?: number | null };
export type SkillPage = { items: Skill[]; page: number; size: number; totalElements: number };
type Request = ReturnType<typeof createApiClient>;
function invalid(): never { throw new ApiError('기술 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); }
function skill(value: unknown): Skill {
  if (typeof value !== 'object' || value === null || !('id' in value) || !('name' in value)
    || typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id <= 0
    || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100) return invalid();
  return { id: value.id, name: value.name };
}
function ownedSkill(value: unknown): OwnedSkill {
  const base = skill(value);
  if (typeof value !== 'object' || value === null
    || !('proficiencyLevel' in value) || !('experienceMonths' in value)) return invalid();
  const level = value.proficiencyLevel;
  const months = value.experienceMonths;
  if (level !== null && (!Number.isInteger(level) || typeof level !== 'number' || level < 1 || level > 5)) return invalid();
  if (months !== null && (!Number.isInteger(months) || typeof months !== 'number' || months < 0 || months > 600)) return invalid();
  return { ...base, proficiencyLevel: level as number | null, experienceMonths: months as number | null };
}
function items(value: unknown): Skill[] {
  if (typeof value !== 'object' || value === null || !('items' in value) || !Array.isArray(value.items)) return invalid();
  const result = value.items.map(skill);
  if (new Set(result.map(item => item.id)).size !== result.length) return invalid();
  return result;
}
export function createSkillsApi(request: Request) {
  async function mutation(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    const csrf = await request('/auth/csrf');
    if (typeof csrf !== 'object' || csrf === null || !('headerName' in csrf) || !('token' in csrf)
      || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token) return invalid();
    return request(path, { method, body, csrfToken: csrf.token });
  }
  return {
    list: async (signal?: AbortSignal): Promise<OwnedSkill[]> => {
      const value = await request('/me/skills', { signal });
      if (typeof value !== 'object' || value === null || !('items' in value) || !Array.isArray(value.items)) return invalid();
      const result = value.items.map(ownedSkill);
      if (new Set(result.map(item => item.id)).size !== result.length) return invalid();
      return result;
    },
    search: async (q: string, page = 0, signal?: AbortSignal): Promise<SkillPage> => {
      const value = await request('/skills', { query: { q, page, size: 20 }, signal });
      const result = items(value);
      if (typeof value !== 'object' || value === null || !('page' in value) || !('size' in value) || !('totalElements' in value)
        || !Number.isSafeInteger(value.page) || value.page !== page || value.size !== 20
        || typeof value.totalElements !== 'number' || !Number.isSafeInteger(value.totalElements)
        || value.totalElements < result.length || result.length > 20) return invalid();
      return { items: result, page, size: 20, totalElements: value.totalElements };
    },
    add: async (selection: { skillId: number } | { name: string }) => skill(await mutation('/me/skills', 'POST', selection)),
    updateExperience: async (id: number, patch: SkillExperiencePatch): Promise<OwnedSkill> => {
      if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError('기술 ID를 확인해 주세요.');
      if (!Object.keys(patch).length || Object.keys(patch).some(key => key !== 'proficiencyLevel' && key !== 'experienceMonths'))
        throw new TypeError('숙련도 또는 경험을 입력해 주세요.');
      if (patch.proficiencyLevel !== undefined && patch.proficiencyLevel !== null
        && (!Number.isInteger(patch.proficiencyLevel) || patch.proficiencyLevel < 1 || patch.proficiencyLevel > 5))
        throw new TypeError('숙련도를 확인해 주세요.');
      if (patch.experienceMonths !== undefined && patch.experienceMonths !== null
        && (!Number.isInteger(patch.experienceMonths) || patch.experienceMonths < 0 || patch.experienceMonths > 600))
        throw new TypeError('경험 개월 수를 확인해 주세요.');
      return ownedSkill(await mutation(`/me/skills/${id}/experience`, 'PATCH', patch));
    },
    remove: async (id: number) => {
      if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError('기술 ID를 확인해 주세요.');
      const value = await mutation(`/me/skills/${id}`, 'DELETE');
      if (value !== undefined) return invalid();
    },
  };
}
