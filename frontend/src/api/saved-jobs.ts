import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';
import { isApplicationStatus } from './application-status.ts';
import type { ApplicationStatus } from './application-status.ts';

export type ManualSavedJobInput = {
  url: string; companyName: string; title: string; role: string | null; careerLevel: string | null;
  location: string | null; employmentType: string | null; deadlineDate: string | null; note: string | null;
  description: string | null;
};
export type ManualSavedJob = ManualSavedJobInput & { id: number; createdAt: string; updatedAt: string };
export type SavedJob = Omit<ManualSavedJob, 'updatedAt'> & {
  kind: 'COLLECTED' | 'MANUAL'; jobId: number | null; source: string; applicationStatus: ApplicationStatus | null;
  analysisStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | null;
};
export type SavedJobsPage = { items: SavedJob[]; page: number; size: number; totalElements: number };
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const id = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const invalid = () => new ApiError('관심공고 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
function manual(v: unknown): ManualSavedJob {
  if (!obj(v) || !id(v.id) || typeof v.url !== 'string' || typeof v.companyName !== 'string'
    || typeof v.title !== 'string' || typeof v.createdAt !== 'string' || typeof v.updatedAt !== 'string') throw invalid();
  return v as ManualSavedJob;
}
export function createSavedJobsApi(request: ReturnType<typeof createApiClient>) {
  async function mutate(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: ManualSavedJobInput) {
    const csrf = await request('/auth/csrf');
    if (!obj(csrf) || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string') throw invalid();
    return request(path, { method, body, csrfToken: csrf.token });
  }
  return {
    async list(page = 0, size = 20, signal?: AbortSignal): Promise<SavedJobsPage> {
      const v = await request('/me/saved-jobs', { query: { page, size }, signal });
      if (!obj(v) || !Array.isArray(v.items) || !Number.isSafeInteger(v.page) || !Number.isSafeInteger(v.size)
        || !Number.isSafeInteger(v.totalElements) || !v.items.every(item => obj(item) && id(item.id)
          && (item.kind === 'COLLECTED' || item.kind === 'MANUAL')
          && (item.jobId === null || id(item.jobId)) && typeof item.title === 'string'
          && typeof item.companyName === 'string' && typeof item.url === 'string'
          && (item.description === null || typeof item.description === 'string')
          && (item.analysisStatus === null || ['PENDING', 'COMPLETED', 'FAILED'].includes(String(item.analysisStatus)))
          && (item.applicationStatus === null || isApplicationStatus(item.applicationStatus)))) throw invalid();
      return v as SavedJobsPage;
    },
    async detail(id: number, signal?: AbortSignal) { return manual(await request(`/me/saved-jobs/${id}`, { signal })); },
    async create(input: ManualSavedJobInput) { return manual(await mutate('/me/saved-jobs', 'POST', input)); },
    async update(id: number, input: ManualSavedJobInput) { return manual(await mutate(`/me/saved-jobs/${id}`, 'PUT', input)); },
    async delete(id: number) { await mutate(`/me/saved-jobs/${id}`, 'DELETE'); },
    async analysis(id: number) { return request(`/me/saved-jobs/${id}/analysis`); },
    async requestAnalysis(id: number) { return mutate(`/me/saved-jobs/${id}/analysis`, 'POST'); },
  };
}
