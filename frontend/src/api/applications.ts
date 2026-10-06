import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';
import { isJobSummary } from './jobs.ts';
import type { JobSummary } from './jobs.ts';
import { isApplicationStatus } from './application-status.ts';
import type { ApplicationStatus } from './application-status.ts';

export type Application = {
  id: number; job: JobSummary; currentStatus: ApplicationStatus; appliedDate: string | null;
  nextScheduleAt: string | null; note: string | null; createdAt: string; updatedAt: string;
};
export type ApplicationPage = { items: Application[]; page: number; size: number; totalElements: number };
export type ApplicationHistory = { id: number; fromStatus: ApplicationStatus | null; toStatus: ApplicationStatus; changedAt: string };
export type CreateApplication = {
  jobId: number; status: 'INTERESTED' | 'PLANNED' | 'APPLIED'; appliedDate: string | null; note: string | null; nextScheduleAt: string | null;
};
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const text = (v: unknown) => v === null || typeof v === 'string';
const instant = (v: unknown) => typeof v === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const invalid = () => new ApiError('지원 정보 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
function parse(v: unknown): Application {
  if (!object(v) || !integer(v.id) || v.id < 1 || !isJobSummary(v.job) || !isApplicationStatus(v.currentStatus)
      || !text(v.note) || !(v.appliedDate === null || (typeof v.appliedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.appliedDate)))
      || !(v.nextScheduleAt === null || instant(v.nextScheduleAt)) || !instant(v.createdAt) || !instant(v.updatedAt)
      || v.job.applicationStatus !== v.currentStatus) throw invalid();
  return v as Application;
}
function validId(id: number) {
  if (!integer(id) || id < 1) throw new ApiError('지원 주소를 확인해 주세요.', 400, 'INVALID_INPUT');
}
export function createApplicationsApi(request: ReturnType<typeof createApiClient>) {
  async function mutate(path: string, method: 'POST' | 'PATCH', body: unknown) {
    const csrf = await request('/auth/csrf');
    if (!object(csrf) || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token) throw invalid();
    return parse(await request(path, { method, body, csrfToken: csrf.token }));
  }
  return {
    async list(query: { status?: ApplicationStatus; page?: number; size?: number } = {}, signal?: AbortSignal): Promise<ApplicationPage> {
      const v = await request('/applications', { query, signal });
      if (!object(v) || !Array.isArray(v.items) || !integer(v.page) || !integer(v.size) || v.size < 1 || v.size > 100 || !integer(v.totalElements)) throw invalid();
      return { items: v.items.map(parse), page: v.page, size: v.size, totalElements: v.totalElements };
    },
    async detail(id: number, signal?: AbortSignal) { validId(id); return parse(await request(`/applications/${id}`, { signal })); },
    async history(id: number, signal?: AbortSignal): Promise<ApplicationHistory[]> {
      validId(id);
      const v = await request(`/applications/${id}/history`, { signal });
      if (!Array.isArray(v) || !v.every(item => object(item) && integer(item.id) && item.id > 0
        && (item.fromStatus === null || isApplicationStatus(item.fromStatus)) && isApplicationStatus(item.toStatus) && instant(item.changedAt))) throw invalid();
      return v as ApplicationHistory[];
    },
    create(input: CreateApplication) { validId(input.jobId); return mutate('/applications', 'POST', input); },
    update(id: number, input: { note?: string | null; nextScheduleAt?: string | null }) {
      validId(id); return mutate(`/applications/${id}`, 'PATCH', input);
    },
    changeStatus(id: number, input: { status: ApplicationStatus; appliedDate?: string | null }) {
      validId(id); return mutate(`/applications/${id}/status`, 'PATCH', input);
    },
  };
}
