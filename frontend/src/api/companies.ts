import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type CompanyStatus = 'INTERESTED' | 'RESEARCHING' | 'ARCHIVED';
export type CompanySize = 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE';
export type InterestLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type CompanyInput = { name: string; websiteUrl: string | null; note: string | null; status: CompanyStatus;
  industry?: string | null; companySize?: CompanySize | null; region?: string | null;
  interestLevel?: InterestLevel; favorite?: boolean; tags?: string[] };
export type InterestedCompany = Omit<CompanyInput, 'industry' | 'companySize' | 'region' | 'interestLevel' | 'favorite' | 'tags'> & {
  id: number; industry: string | null; companySize: CompanySize | null; region: string | null;
  interestLevel: InterestLevel; favorite: boolean; tags: string[]; createdAt: string; updatedAt: string };
export type CompanyPage = { items: InterestedCompany[]; page: number; size: number; totalElements: number };
export type CompanyFilters = { q?: string; industry?: string; companySize?: CompanySize; region?: string;
  interestLevel?: InterestLevel; favorite?: boolean; tag?: string; order?: 'latest' | 'oldest' | 'name' };
export type CompanyTag = { id: number; name: string; colorKey: string; sortOrder: number };

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const statuses: CompanyStatus[] = ['INTERESTED', 'RESEARCHING', 'ARCHIVED'];
const sizes: CompanySize[] = ['STARTUP', 'SMALL', 'MEDIUM', 'LARGE'];
const interests: InterestLevel[] = ['HIGH', 'MEDIUM', 'LOW'];
const validInstant = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));
function invalid(): never { throw new ApiError('기업 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); }

export function companyLink(value: string | null): string | undefined {
  if (!value || /\s/.test(value)) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password && !url.hash
      ? value : undefined;
  } catch { return undefined; }
}
function company(value: unknown): InterestedCompany {
  if (!value || typeof value !== 'object') return invalid();
  const item = value as Record<string, unknown>;
  if (!positive(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200
    || (item.websiteUrl !== null && (typeof item.websiteUrl !== 'string' || item.websiteUrl.length > 2048 || !companyLink(item.websiteUrl)))
    || (item.note !== null && (typeof item.note !== 'string' || item.note.length > 2000))
    || !statuses.includes(item.status as CompanyStatus)
    || (item.industry !== undefined && item.industry !== null && (typeof item.industry !== 'string' || item.industry.length > 80))
    || (item.companySize !== undefined && item.companySize !== null && !sizes.includes(item.companySize as CompanySize))
    || (item.region !== undefined && item.region !== null && (typeof item.region !== 'string' || item.region.length > 80))
    || (item.interestLevel !== undefined && !interests.includes(item.interestLevel as InterestLevel))
    || (item.favorite !== undefined && typeof item.favorite !== 'boolean')
    || (item.tags !== undefined && (!Array.isArray(item.tags) || item.tags.length > 5
      || item.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 30)))
    || !validInstant(item.createdAt) || !validInstant(item.updatedAt)) return invalid();
  return { ...item, industry: item.industry ?? null, companySize: item.companySize ?? null,
    region: item.region ?? null, interestLevel: item.interestLevel ?? 'MEDIUM',
    favorite: item.favorite ?? false, tags: item.tags ?? [] } as InterestedCompany;
}
function tag(value: unknown): CompanyTag {
  if (!value || typeof value !== 'object' || !('id' in value) || !positive(value.id)
    || !('name' in value) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 20
    || !('colorKey' in value) || typeof value.colorKey !== 'string'
    || !('sortOrder' in value) || typeof value.sortOrder !== 'number' || !Number.isSafeInteger(value.sortOrder)) return invalid();
  return value as CompanyTag;
}
export function createCompaniesApi(request: ReturnType<typeof createApiClient>) {
  function path(id: number) {
    if (!positive(id)) throw new TypeError('기업 ID를 확인해 주세요.');
    return '/me/companies/' + id;
  }
  async function mutation(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown) {
    const csrf = await request('/auth/csrf');
    if (!csrf || typeof csrf !== 'object' || !('headerName' in csrf) || !('token' in csrf)
      || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token) return invalid();
    return request(url, { method, body, csrfToken: csrf.token });
  }
  return {
    list: async (page = 0, signal?: AbortSignal, filters: CompanyFilters = {}): Promise<CompanyPage> => {
      if (!Number.isSafeInteger(page) || page < 0) throw new TypeError('페이지를 확인해 주세요.');
      const value = await request('/me/companies', { query: { page, size: 20, ...filters }, signal });
      if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)
        || !('page' in value) || value.page !== page || !('size' in value) || value.size !== 20
        || !('totalElements' in value) || typeof value.totalElements !== 'number'
        || !Number.isSafeInteger(value.totalElements) || value.totalElements < value.items.length
        || value.items.length > 20) return invalid();
      const items = value.items.map(company);
      if (new Set(items.map(item => item.id)).size !== items.length) return invalid();
      return { items, page, size: 20, totalElements: value.totalElements };
    },
    get: async (id: number, signal?: AbortSignal) => company(await request(path(id), { signal })),
    create: async (input: CompanyInput) => company(await mutation('/me/companies', 'POST', input)),
    update: async (id: number, input: CompanyInput) => company(await mutation(path(id), 'PATCH', input)),
    remove: async (id: number) => { if (await mutation(path(id), 'DELETE') !== undefined) return invalid(); },
    listTags: async (): Promise<CompanyTag[]> => {
      const value = await request('/me/company-tags');
      if (!Array.isArray(value)) return invalid();
      return value.map(tag);
    },
    createTag: async (name: string, colorKey: string): Promise<CompanyTag> =>
      tag(await mutation('/me/company-tags', 'POST', { name, colorKey })),
    updateTag: async (id: number, name: string, colorKey: string): Promise<CompanyTag> =>
      tag(await mutation(`/me/company-tags/${id}`, 'PATCH', { name, colorKey })),
    reorderTags: async (tagIds: number[]): Promise<CompanyTag[]> => {
      const value = await mutation('/me/company-tags/order', 'PUT', { tagIds });
      if (!Array.isArray(value)) return invalid();
      return value.map(tag);
    },
    removeTag: async (id: number): Promise<void> => {
      if (!positive(id)) throw new TypeError('태그 ID를 확인해 주세요.');
      if (await mutation(`/me/company-tags/${id}`, 'DELETE') !== undefined) return invalid();
    },
  };
}
