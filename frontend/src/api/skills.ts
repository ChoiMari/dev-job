import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type Skill = { id: number; name: string };
export type SkillPage = { items: Skill[]; page: number; size: number; totalElements: number };
type Request = ReturnType<typeof createApiClient>;
function invalid(): never { throw new ApiError('기술 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); }
function skill(value: unknown): Skill {
  if (typeof value !== 'object' || value === null || !('id' in value) || !('name' in value)
    || typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id <= 0
    || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100) return invalid();
  return { id: value.id, name: value.name };
}
function items(value: unknown): Skill[] {
  if (typeof value !== 'object' || value === null || !('items' in value) || !Array.isArray(value.items)) return invalid();
  const result = value.items.map(skill);
  if (new Set(result.map(item => item.id)).size !== result.length) return invalid();
  return result;
}
export function createSkillsApi(request: Request) {
  async function mutation(path: string, method: 'POST' | 'DELETE', body?: unknown) {
    const csrf = await request('/auth/csrf');
    if (typeof csrf !== 'object' || csrf === null || !('headerName' in csrf) || !('token' in csrf)
      || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token) return invalid();
    return request(path, { method, body, csrfToken: csrf.token });
  }
  return {
    list: async (signal?: AbortSignal) => items(await request('/me/skills', { signal })),
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
    remove: async (id: number) => {
      if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError('기술 ID를 확인해 주세요.');
      const value = await mutation(`/me/skills/${id}`, 'DELETE');
      if (value !== undefined) return invalid();
    },
  };
}
