import type { createApiClient } from './client';
import { ApiError } from './client';

export type CoverLetterDraftSummary = { id: number; title: string; updatedAt: string };
export type CoverLetterDraftDetail = CoverLetterDraftSummary & { content: string };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const validId = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const summary = (v: unknown): v is CoverLetterDraftSummary => record(v) && validId(v.id)
  && typeof v.title === 'string' && typeof v.updatedAt === 'string' && !Number.isNaN(Date.parse(v.updatedAt));
const invalid = (): never => { throw new ApiError('임시저장 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); };

export function createCoverLetterDraftApi(request: ReturnType<typeof createApiClient>) {
  const base = '/me/cover-letters/drafts';
  const path = (id: number) => { if (!validId(id)) throw new TypeError('임시저장 ID를 확인해 주세요.'); return `${base}/${id}`; };
  const csrf = async () => {
    const v = await request('/auth/csrf');
    return record(v) && v.headerName === 'X-CSRF-TOKEN' && typeof v.token === 'string' && v.token ? v.token : invalid();
  };
  return {
    list: async (signal?: AbortSignal): Promise<CoverLetterDraftSummary[]> => {
      let v: unknown;
      try { v = await request(base, { signal }); }
      catch (error) {
        if (error instanceof ApiError && error.status === 400)
          throw new ApiError('임시저장 기능이 현재 서버에 적용되지 않았습니다. 서버를 갱신한 뒤 다시 시도해 주세요.', 400, 'DRAFT_API_UNAVAILABLE');
        throw error;
      }
      return Array.isArray(v) && v.every(summary) ? v : invalid();
    },
    get: async (id: number, signal?: AbortSignal): Promise<CoverLetterDraftDetail> => {
      const v = await request(path(id), { signal });
      return summary(v) && v.id === id && typeof (v as Record<string, unknown>).content === 'string' ? v as CoverLetterDraftDetail : invalid();
    },
    save: async (title: string, content: string, id?: number): Promise<CoverLetterDraftSummary> => {
      const v = await request(id === undefined ? base : path(id), {
        method: id === undefined ? 'POST' : 'PUT', body: { title, content }, csrfToken: await csrf(),
      });
      return summary(v) ? v : invalid();
    },
    remove: async (id: number): Promise<void> => { await request(path(id), { method: 'DELETE', csrfToken: await csrf() }); },
  };
}
