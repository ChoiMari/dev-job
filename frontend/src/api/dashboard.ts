import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';
import { applicationStatuses, isApplicationStatus } from './application-status.ts';
import type { ApplicationStatus } from './application-status.ts';
import { isJobSummary } from './jobs.ts';
import type { JobSummary } from './jobs.ts';
import type { Skill } from './analysis.ts';

export type Dashboard = {
  applicationCounts: Record<ApplicationStatus, number>;
  bookmarkCount: number;
  nextActions: { applicationId: number; jobId: number | null; jobTitle: string; status: ApplicationStatus; nextScheduleAt: string | null }[];
  recommendedJobs: JobSummary[];
  skillGapPreview: Skill[];
};
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function isDashboard(value: unknown): value is Dashboard {
  return object(value) && object(value.applicationCounts) && applicationStatuses.every(status => count((value.applicationCounts as Record<string, unknown>)[status]))
    && count(value.bookmarkCount) && Array.isArray(value.nextActions) && value.nextActions.length <= 5
    && value.nextActions.every(action => object(action) && count(action.applicationId) && action.applicationId > 0
      && (action.jobId === null || (count(action.jobId) && action.jobId > 0)) && typeof action.jobTitle === 'string' && isApplicationStatus(action.status)
      && (action.nextScheduleAt === null || (typeof action.nextScheduleAt === 'string' && Number.isFinite(Date.parse(action.nextScheduleAt)))))
    && Array.isArray(value.recommendedJobs) && value.recommendedJobs.length <= 3 && value.recommendedJobs.every(isJobSummary)
    && Array.isArray(value.skillGapPreview) && value.skillGapPreview.length <= 5
    && value.skillGapPreview.every(skill => object(skill) && count(skill.id) && skill.id > 0 && typeof skill.name === 'string' && skill.name.length > 0);
}
export function createDashboardApi(request: ReturnType<typeof createApiClient>) {
  return { async get(signal?: AbortSignal): Promise<Dashboard> {
    const value = await request('/dashboard', { signal });
    if (!isDashboard(value)) throw new ApiError('대시보드 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
    return value;
  } };
}
