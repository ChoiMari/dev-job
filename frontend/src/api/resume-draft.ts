import type { createApiClient } from './client.ts';
import { ApiError } from './client.ts';

export type ResumeDraftSummary = { id: number; title: string; mode: 'free' | 'template'; updatedAt: string;
  purpose?: 'version-new' | 'version-edit'; resumeId?: number; versionId?: number };

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const validId = (id: number) => Number.isSafeInteger(id) && id > 0;
const summary = (value: unknown): value is ResumeDraftSummary => record(value) && typeof value.id === 'number'
  && validId(value.id) && typeof value.title === 'string' && (value.mode === 'free' || value.mode === 'template')
  && typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt))
  && (value.purpose === undefined || ((value.purpose === 'version-new' || value.purpose === 'version-edit')
    && typeof value.resumeId === 'number' && validId(value.resumeId)
    && (value.purpose === 'version-new' ? value.versionId === undefined : typeof value.versionId === 'number' && validId(value.versionId))));
const invalid = (): never => { throw new ApiError('임시저장 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); };

export function createResumeDraftApi(request: ReturnType<typeof createApiClient>) {
  const base = '/me/resumes/drafts';
  const path = (id: number) => { if (!validId(id)) throw new TypeError('임시저장 ID를 확인해 주세요.'); return `${base}/${id}`; };
  const csrf = async () => {
    const value = await request('/auth/csrf');
    if (!record(value) || value.headerName !== 'X-CSRF-TOKEN' || typeof value.token !== 'string' || !value.token)
      throw new ApiError('보안 토큰을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
    return value.token;
  };
  return {
    list: async (signal?: AbortSignal): Promise<ResumeDraftSummary[]> => {
      const value = await request(base, { signal });
      return Array.isArray(value) && value.every(summary) ? value : invalid();
    },
    get: async (id: number, signal?: AbortSignal): Promise<unknown> => request(path(id), { signal }),
    save: async (draft: unknown, id?: number): Promise<ResumeDraftSummary> => {
      const value = await request(id === undefined ? base : path(id), {
        method: id === undefined ? 'POST' : 'PUT', body: draft, csrfToken: await csrf(),
      });
      return summary(value) ? value : invalid();
    },
    remove: async (id: number): Promise<void> => { await request(path(id), { method: 'DELETE', csrfToken: await csrf() }); },
  };
}
