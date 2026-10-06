import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';
import { isApplicationStatus } from './application-status.ts';
import type { ApplicationStatus } from './application-status.ts';

export type JobSummary = {
  id: number; title: string; company: { id: number; name: string }; source: string;
  location: string | null; careerRequirement: string | null; employmentType: string | null;
  deadlineDate: string | null; matchRate: number | null; bookmarked: boolean; applicationStatus: ApplicationStatus | null;
};
export type JobDetail = JobSummary & {
  description: string | null; postedDate: string | null; sourceUrl: string;
  requiredSkills: unknown[]; preferredSkills: unknown[]; analysis: unknown;
};
export type JobPage = { items: JobSummary[]; page: number; size: number; totalElements: number };
export type JobFilters = { q?: string; company?: string; careerLevel?: string; location?: string;
  employmentType?: string; deadlineBefore?: string; applicationStatus?: ApplicationStatus; page?: number; size?: number; sort?: 'latest' | 'deadline' };

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const nullableText = (v: unknown) => v === null || typeof v === 'string';
export function isJobSummary(v: unknown): v is JobSummary & Record<string, unknown> {
  return object(v) && integer(v.id) && v.id > 0 && typeof v.title === 'string'
    && object(v.company) && integer(v.company.id) && v.company.id > 0 && typeof v.company.name === 'string'
    && typeof v.source === 'string' && ['location', 'careerRequirement', 'employmentType', 'deadlineDate'].every(k => nullableText(v[k]))
    && (v.applicationStatus === null || isApplicationStatus(v.applicationStatus))
    && (v.matchRate === null || (integer(v.matchRate) && v.matchRate <= 100)) && typeof v.bookmarked === 'boolean';
}
const invalid = () => new ApiError('공고 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
export function createJobsApi(request: ReturnType<typeof createApiClient>) {
  return {
    async list(query: JobFilters, signal?: AbortSignal): Promise<JobPage> {
      const value = await request('/jobs', { query, signal });
      if (!object(value) || !Array.isArray(value.items) || !value.items.every(isJobSummary)
        || !integer(value.page) || !integer(value.size) || value.size < 1 || value.size > 100 || !integer(value.totalElements)) throw invalid();
      return value as JobPage;
    },
    async detail(id: number, signal?: AbortSignal): Promise<JobDetail> {
      if (!integer(id) || id < 1) throw new ApiError('공고 주소를 확인해 주세요.', 400, 'INVALID_INPUT');
      const value = await request(`/jobs/${id}`, { signal });
      if (!isJobSummary(value) || !object(value) || !nullableText(value.description) || !nullableText(value.postedDate)
        || typeof value.sourceUrl !== 'string' || !Array.isArray(value.requiredSkills) || !Array.isArray(value.preferredSkills)
        || !('analysis' in value)) throw invalid();
      try { if (!['http:', 'https:'].includes(new URL(value.sourceUrl).protocol)) throw invalid(); }
      catch { throw invalid(); }
      return value as JobDetail;
    },
  };
}
