import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type CompanyStatus = 'INTERESTED' | 'RESEARCHING' | 'ARCHIVED';
export type CompanyInput = { name: string; websiteUrl: string | null; note: string | null; status: CompanyStatus };
export type InterestedCompany = CompanyInput & { id: number; createdAt: string; updatedAt: string };
export type CompanyPage = { items: InterestedCompany[]; page: number; size: number; totalElements: number };

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const statuses: CompanyStatus[] = ['INTERESTED', 'RESEARCHING', 'ARCHIVED'];
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
    || !validInstant(item.createdAt) || !validInstant(item.updatedAt)) return invalid();
  return item as InterestedCompany;
}
export function createCompaniesApi(request: ReturnType<typeof createApiClient>) {
  function path(id: number) {
    if (!positive(id)) throw new TypeError('기업 ID를 확인해 주세요.');
    return '/me/companies/' + id;
  }
  async function mutation(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: CompanyInput) {
    const csrf = await request('/auth/csrf');
    if (!csrf || typeof csrf !== 'object' || !('headerName' in csrf) || !('token' in csrf)
      || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token) return invalid();
    return request(url, { method, body, csrfToken: csrf.token });
  }
  return {
    list: async (page = 0, signal?: AbortSignal): Promise<CompanyPage> => {
      if (!Number.isSafeInteger(page) || page < 0) throw new TypeError('페이지를 확인해 주세요.');
      const value = await request('/me/companies', { query: { page, size: 20 }, signal });
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
  };
}
