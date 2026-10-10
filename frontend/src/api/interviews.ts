import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type InterviewStatus = 'SCHEDULED' | 'CANCELLED';
export type Interview = {
  id: number; applicationId: number | null; title: string; startsAt: string; timeZone: string;
  status: InterviewStatus; cancelledAt: string | null; createdAt: string; updatedAt: string;
};
export type InterviewInput = Pick<Interview, 'applicationId' | 'title' | 'startsAt' | 'timeZone'>;
export type InterviewPage = { items: Interview[]; page: number; size: number; totalElements: number };
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const instant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const offset = (value: unknown): value is string => instant(value) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
function zone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 100) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}
function invalid(): never { throw new ApiError('면접 일정 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); }
export function isInterview(value: unknown): value is Interview {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return positive(item.id) && (item.applicationId === null || positive(item.applicationId))
    && typeof item.title === 'string' && !!item.title.trim() && item.title.length <= 200
    && offset(item.startsAt) && zone(item.timeZone)
    && (item.status === 'SCHEDULED' || item.status === 'CANCELLED')
    && (item.status === 'SCHEDULED' ? item.cancelledAt === null : instant(item.cancelledAt))
    && instant(item.createdAt) && instant(item.updatedAt);
}
export function createInterviewsApi(request: ReturnType<typeof createApiClient>) {
  function path(id: number) { if (!positive(id)) throw new TypeError('면접 일정 ID를 확인해 주세요.'); return `/me/interviews/${id}`; }
  async function mutation(url: string, method: 'POST' | 'PATCH', body?: unknown) {
    const csrf = await request('/auth/csrf');
    if (!csrf || typeof csrf !== 'object' || !('headerName' in csrf) || !('token' in csrf)
      || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token) return invalid();
    return request(url, { method, body, csrfToken: csrf.token });
  }
  function parse(value: unknown): Interview { return isInterview(value) ? value : invalid(); }
  return {
    list: async (page = 0, signal?: AbortSignal): Promise<InterviewPage> => {
      if (!Number.isSafeInteger(page) || page < 0) throw new TypeError('페이지를 확인해 주세요.');
      const value = await request('/me/interviews', { query: { page, size: 20 }, signal });
      if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)
        || !('page' in value) || value.page !== page || !('size' in value) || value.size !== 20
        || !('totalElements' in value) || typeof value.totalElements !== 'number'
        || !Number.isSafeInteger(value.totalElements) || value.totalElements < value.items.length
        || value.items.length > 20 || !value.items.every(isInterview)
        || new Set(value.items.map(item => item.id)).size !== value.items.length) return invalid();
      return { items: value.items, page, size: 20, totalElements: value.totalElements };
    },
    get: async (id: number, signal?: AbortSignal) => parse(await request(path(id), { signal })),
    create: async (input: InterviewInput) => parse(await mutation('/me/interviews', 'POST', input)),
    update: async (id: number, patch: Partial<InterviewInput>) => parse(await mutation(path(id), 'PATCH', patch)),
    cancel: async (id: number) => parse(await mutation(`${path(id)}/cancel`, 'POST')),
    reactivate: async (id: number) => parse(await mutation(`${path(id)}/reactivate`, 'POST')),
  };
}
