export const applicationStatuses = ['INTERESTED', 'PLANNED', 'APPLIED', 'DOCUMENT_PASSED', 'INTERVIEW', 'FINAL_PASSED', 'REJECTED', 'WITHDRAWN'] as const;
export type ApplicationStatus = typeof applicationStatuses[number];
export const statusLabels: Record<ApplicationStatus, string> = {
  INTERESTED: '관심', PLANNED: '지원 예정', APPLIED: '지원 완료', DOCUMENT_PASSED: '서류 통과',
  INTERVIEW: '면접', FINAL_PASSED: '최종 합격', REJECTED: '탈락', WITHDRAWN: '철회',
};
export const nextStatuses: Record<ApplicationStatus, ApplicationStatus[]> = {
  INTERESTED: ['PLANNED', 'WITHDRAWN'], PLANNED: ['APPLIED', 'WITHDRAWN'],
  APPLIED: ['DOCUMENT_PASSED', 'REJECTED', 'WITHDRAWN'], DOCUMENT_PASSED: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['FINAL_PASSED', 'REJECTED'], FINAL_PASSED: [], REJECTED: [], WITHDRAWN: [],
};
export const isApplicationStatus = (value: unknown): value is ApplicationStatus =>
  typeof value === 'string' && applicationStatuses.includes(value as ApplicationStatus);
export function localSchedule(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function scheduleInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
