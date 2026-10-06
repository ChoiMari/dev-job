import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type Skill = { id: number; name: string };
export type Analysis = { status: 'PENDING' | 'COMPLETED' | 'FAILED'; requiredSkills: Skill[];
  preferredSkills: Skill[]; analyzedAt: string | null; failureReason: string | null };
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const skill = (v: unknown): v is Skill => object(v) && typeof v.id === 'number' && Number.isSafeInteger(v.id)
  && v.id > 0 && typeof v.name === 'string' && v.name.length > 0;
const invalid = () => new ApiError('분석 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
export function isAnalysis(v: unknown): v is Analysis {
  if (!object(v) || !['PENDING', 'COMPLETED', 'FAILED'].includes(String(v.status))
    || !Array.isArray(v.requiredSkills) || !v.requiredSkills.every(skill)
    || !Array.isArray(v.preferredSkills) || !v.preferredSkills.every(skill)
    || (v.analyzedAt !== null && (typeof v.analyzedAt !== 'string' || !Number.isFinite(Date.parse(v.analyzedAt))))
    || (v.failureReason !== null && typeof v.failureReason !== 'string')) return false;
  return v.status === 'COMPLETED' ? v.analyzedAt !== null && v.failureReason === null
    : v.requiredSkills.length === 0 && v.preferredSkills.length === 0 && v.analyzedAt === null
      && (v.status === 'FAILED' ? typeof v.failureReason === 'string' : v.failureReason === null);
}
export function createAnalysisApi(request: ReturnType<typeof createApiClient>) {
  const path = (id: number) => {
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError('공고 주소를 확인해 주세요.', 400, 'INVALID_INPUT');
    return `/jobs/${id}/analysis`;
  };
  return {
    async get(id: number, signal?: AbortSignal): Promise<Analysis> {
      const value = await request(path(id), { signal });
      if (!isAnalysis(value)) throw invalid();
      return value;
    },
    async request(id: number): Promise<Analysis> {
      const target = path(id);
      const csrf = await request('/auth/csrf');
      if (!object(csrf) || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token) throw invalid();
      const value = await request(target, { method: 'POST', csrfToken: csrf.token });
      if (!isAnalysis(value)) throw invalid();
      return value;
    },
  };
}
