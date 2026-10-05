import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';
import type { Skill } from './skills.ts';

export type ProjectInput = { name: string; description: string | null; startDate: string; endDate: string | null;
  role: string | null; keyFeatures: string | null; outcome: string | null; projectUrl: string | null; skillIds: number[] };
export type Project = Omit<ProjectInput, 'skillIds'> & { id: number; skills: Skill[] };
export type ProjectPage = { items: Project[]; page: number; size: number; totalElements: number };
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function projectLink(value: string | null): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? value : undefined; }
  catch { return undefined; }
}
function invalid(): never { throw new ApiError('프로젝트 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); }
function project(value: unknown): Project {
  if (!value || typeof value !== 'object') return invalid();
  const item = value as Record<string, unknown>;
  if (!positive(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100 || !date(item.startDate)
    || (item.endDate !== null && (!date(item.endDate) || item.endDate < item.startDate))) return invalid();
  for (const [key, max] of [['description', 2000], ['role', 100], ['keyFeatures', 2000], ['outcome', 2000], ['projectUrl', 2000]] as const) {
    if (item[key] !== null && (typeof item[key] !== 'string' || (item[key] as string).length > max)) return invalid();
  }
  if (item.projectUrl !== null && !projectLink(item.projectUrl as string)) return invalid();
  if (!Array.isArray(item.skills) || item.skills.some(skill => !skill || !positive(skill.id)
    || typeof skill.name !== 'string' || !skill.name.trim() || skill.name.length > 100)
    || new Set(item.skills.map(skill => skill.id)).size !== item.skills.length) return invalid();
  return item as Project;
}
export function createProjectsApi(request: ReturnType<typeof createApiClient>) {
  function path(id: number) { if (!positive(id)) throw new TypeError('프로젝트 ID를 확인해 주세요.'); return `/me/projects/${id}`; }
  async function mutation(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: ProjectInput) {
    const csrf = await request('/auth/csrf');
    if (!csrf || typeof csrf !== 'object' || !('headerName' in csrf) || !('token' in csrf)
      || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token) return invalid();
    return request(url, { method, body, csrfToken: csrf.token });
  }
  return {
    list: async (page = 0, signal?: AbortSignal): Promise<ProjectPage> => {
      const value = await request('/me/projects', { query: { page, size: 20 }, signal });
      if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)
        || !('page' in value) || value.page !== page || !('size' in value) || value.size !== 20
        || !('totalElements' in value) || typeof value.totalElements !== 'number' || !Number.isSafeInteger(value.totalElements)
        || value.totalElements < value.items.length || value.items.length > 20) return invalid();
      const items = value.items.map(project);
      if (new Set(items.map(item => item.id)).size !== items.length) return invalid();
      return { items, page, size: 20, totalElements: value.totalElements };
    },
    get: async (id: number, signal?: AbortSignal) => project(await request(path(id), { signal })),
    create: async (input: ProjectInput) => project(await mutation('/me/projects', 'POST', input)),
    update: async (id: number, input: ProjectInput) => project(await mutation(path(id), 'PUT', input)),
    remove: async (id: number) => { if (await mutation(path(id), 'DELETE') !== undefined) return invalid(); },
  };
}
