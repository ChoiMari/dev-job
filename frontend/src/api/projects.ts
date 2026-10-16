import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';
import type { Skill } from './skills.ts';

export type ProjectType = 'UNSPECIFIED' | 'PERSONAL' | 'TEAM';
export type ProjectInput = { name: string; projectType: ProjectType; description: string | null; startDate: string; endDate: string | null;
  role: string | null; keyFeatures: string | null; outcome: string | null; projectUrl: string | null; skillIds: number[];
  summary: string | null; category: string | null; teamSize: number | null; problemSolving: string | null;
  featureItems: string[]; achievementItems: string[]; demoUrl: string | null; githubUrl: string | null;
  presentationUrl: string | null; contributionPercent: number | null; responsibilities: string | null;
  troubleshooting: string | null; metricItems: string[]; skillUsages: { skillId: number; usage: string | null }[];
  contributionItems: { responsibility: string; percent: number }[]; troubleshootingItems: string[];
  customSkills: { name: string; usage: string | null }[] };
export type Project = Omit<ProjectInput, 'skillIds'> & { id: number; skills: Skill[] };
export type ProjectPage = { items: Project[]; page: number; size: number; totalElements: number };
export type ProjectImage = { id: number; kind: 'THUMBNAIL' | 'ADDITIONAL'; fileName: string; byteSize: number; viewUrl: string };
export type ProjectFilters = { q?: string; projectType?: Exclude<ProjectType, 'UNSPECIFIED'>; status?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'; sort?: 'NEWEST' | 'OLDEST' };
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function projectLink(value: string | null): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? value : undefined; }
  catch { return undefined; }
}
function invalid(): never { throw new ApiError('프로젝트 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); }
function optionalText(item: Record<string, unknown>, key: string, max: number): string | null {
  const value = item[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > max) return invalid();
  return value;
}
function optionalList(item: Record<string, unknown>, key: string, max: number): string[] {
  const value = item[key];
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10 || value.some(entry => typeof entry !== 'string' || !entry.trim() || entry.length > max)) return invalid();
  return value;
}
function optionalNumber(item: Record<string, unknown>, key: string, min: number, max: number): number | null {
  const value = item[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) return invalid();
  return value;
}
function project(value: unknown): Project {
  if (!value || typeof value !== 'object') return invalid();
  const item = value as Record<string, unknown>;
  if (!positive(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100
    || !['UNSPECIFIED', 'PERSONAL', 'TEAM'].includes(item.projectType as string) || !date(item.startDate)
    || (item.endDate !== null && (!date(item.endDate) || item.endDate < item.startDate))) return invalid();
  for (const [key, max] of [['description', 2000], ['role', 100], ['keyFeatures', 2000], ['outcome', 2000], ['projectUrl', 2000]] as const) {
    if (item[key] !== null && (typeof item[key] !== 'string' || (item[key] as string).length > max)) return invalid();
  }
  if (item.projectUrl !== null && !projectLink(item.projectUrl as string)) return invalid();
  if (!Array.isArray(item.skills) || item.skills.some(skill => !skill || !positive(skill.id)
    || typeof skill.name !== 'string' || !skill.name.trim() || skill.name.length > 100)
    || new Set(item.skills.map(skill => skill.id)).size !== item.skills.length) return invalid();
  const skillUsages = item.skillUsages === undefined ? [] : item.skillUsages;
  if (!Array.isArray(skillUsages) || skillUsages.some(entry => !entry || !positive(entry.skillId)
    || (entry.usage !== null && (typeof entry.usage !== 'string' || entry.usage.length > 1000)))) return invalid();
  const contributionItems = item.contributionItems === undefined ? [] : item.contributionItems;
  if (!Array.isArray(contributionItems) || contributionItems.length > 10 || contributionItems.some(entry => !entry
    || typeof entry.responsibility !== 'string' || !entry.responsibility.trim() || entry.responsibility.length > 1000
    || typeof entry.percent !== 'number' || !Number.isInteger(entry.percent) || entry.percent < 0 || entry.percent > 100)) return invalid();
  const customSkills = item.customSkills === undefined ? [] : item.customSkills;
  if (!Array.isArray(customSkills) || customSkills.length > 20 || customSkills.some(entry => !entry
    || typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 100
    || (entry.usage !== null && (typeof entry.usage !== 'string' || entry.usage.length > 1000)))
    || new Set(customSkills.map(entry => entry.name.normalize('NFKC').trim().toLowerCase())).size !== customSkills.length) return invalid();
  const enriched = {
    ...item, summary: optionalText(item, 'summary', 200), category: optionalText(item, 'category', 100),
    teamSize: optionalNumber(item, 'teamSize', 1, 99), problemSolving: optionalText(item, 'problemSolving', 1000),
    featureItems: optionalList(item, 'featureItems', 2000), achievementItems: optionalList(item, 'achievementItems', 2000),
    demoUrl: optionalText(item, 'demoUrl', 2000), githubUrl: optionalText(item, 'githubUrl', 2000),
    presentationUrl: optionalText(item, 'presentationUrl', 2000),
    contributionPercent: optionalNumber(item, 'contributionPercent', 0, 100),
    responsibilities: optionalText(item, 'responsibilities', 1000), troubleshooting: optionalText(item, 'troubleshooting', 1000),
    metricItems: optionalList(item, 'metricItems', 1000), skillUsages, contributionItems,
    troubleshootingItems: optionalList(item, 'troubleshootingItems', 1000), customSkills,
  };
  for (const key of ['demoUrl', 'githubUrl', 'presentationUrl'] as const) {
    if (enriched[key] !== null && !projectLink(enriched[key])) return invalid();
  }
  return enriched as Project;
}
export function createProjectsApi(request: ReturnType<typeof createApiClient>) {
  function path(id: number) { if (!positive(id)) throw new TypeError('프로젝트 ID를 확인해 주세요.'); return `/me/projects/${id}`; }
  async function mutation(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
    const csrf = await request('/auth/csrf');
    if (!csrf || typeof csrf !== 'object' || !('headerName' in csrf) || !('token' in csrf)
      || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token) return invalid();
    return request(url, { method, body, csrfToken: csrf.token });
  }
  return {
    imageStorageAvailable: async (): Promise<boolean> => {
      const value = await request('/me/project-image-storage');
      if (!value || typeof value !== 'object' || !('available' in value) || typeof value.available !== 'boolean') return invalid();
      return value.available;
    },
    images: async (id: number): Promise<ProjectImage[]> => {
      const value = await request(`${path(id)}/images`);
      if (!Array.isArray(value) || value.some(item => !item || !positive(item.id) || !['THUMBNAIL', 'ADDITIONAL'].includes(item.kind)
        || typeof item.fileName !== 'string' || typeof item.byteSize !== 'number' || typeof item.viewUrl !== 'string')) return invalid();
      return value as ProjectImage[];
    },
    uploadImage: async (id: number, kind: ProjectImage['kind'], file: File): Promise<ProjectImage> => {
      if (!['image/jpeg', 'image/png'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) {
        throw new Error('JPG/PNG 이미지 파일을 5MB 이하로 선택해 주세요.');
      }
      const base = `${path(id)}/images`;
      const ticket = await mutation(`${base}/uploads`, 'POST', { kind, fileName: file.name, contentType: file.type, byteSize: file.size });
      if (!ticket || typeof ticket !== 'object' || !('imageId' in ticket) || !positive(ticket.imageId)
        || !('uploadUrl' in ticket) || typeof ticket.uploadUrl !== 'string') return invalid();
      try {
        const upload = await fetch(ticket.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!upload.ok) throw new Error('이미지 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        const completed = await mutation(`${base}/${ticket.imageId}/complete`, 'POST');
        if (!completed || typeof completed !== 'object' || !('id' in completed) || completed.id !== ticket.imageId) return invalid();
        return completed as ProjectImage;
      } catch (cause) {
        await mutation(`${base}/${ticket.imageId}`, 'DELETE').catch(() => undefined);
        throw cause;
      }
    },
    removeImage: async (id: number, imageId: number) => { if (await mutation(`${path(id)}/images/${imageId}`, 'DELETE') !== undefined) return invalid(); },
    list: async (page = 0, signal?: AbortSignal, filters: ProjectFilters = {}): Promise<ProjectPage> => {
      const value = await request('/me/projects', { query: { page, size: 20, ...filters }, signal });
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
