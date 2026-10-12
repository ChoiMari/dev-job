export const applicationStatuses = ['INTERESTED', 'PLANNED', 'APPLIED', 'DOCUMENT_PASSED', 'INTERVIEW', 'FINAL_PASSED', 'REJECTED', 'WITHDRAWN'] as const;
export type ApplicationStatus = typeof applicationStatuses[number];
export const newApplicationStatuses = ['PLANNED', 'APPLIED', 'DOCUMENT_PASSED', 'INTERVIEW', 'FINAL_PASSED', 'REJECTED', 'WITHDRAWN'] as const;
export const statusLabels: Record<ApplicationStatus, string> = {
  INTERESTED: '관심', PLANNED: '지원 예정', APPLIED: '서류 접수', DOCUMENT_PASSED: '서류 합격',
  INTERVIEW: '면접', FINAL_PASSED: '최종 합격', REJECTED: '불합격', WITHDRAWN: '철회',
};
const movableStatuses: ApplicationStatus[] = applicationStatuses.filter(status => status !== 'INTERESTED');
export const nextStatuses: Record<ApplicationStatus, ApplicationStatus[]> = Object.fromEntries(
  applicationStatuses.map(status => [status, movableStatuses.filter(next => next !== status)]),
) as Record<ApplicationStatus, ApplicationStatus[]>;
export const isApplicationStatus = (value: unknown): value is ApplicationStatus =>
  typeof value === 'string' && applicationStatuses.includes(value as ApplicationStatus);
export function statusChangeInput(target: ApplicationStatus, existingAppliedDate: string | null, enteredAppliedDate = '') {
  if (target === 'PLANNED' || existingAppliedDate) return { status: target };
  return { status: target, appliedDate: enteredAppliedDate || null };
}
export function localSchedule(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function scheduleInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
