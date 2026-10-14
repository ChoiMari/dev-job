import type { ApplicationStatus } from '../api/application-status';
import { statusLabels } from '../api/application-status';
import { LucideIcon } from './LucideIcon';
import type { LucideIconName } from './LucideIcon';
import './JobStatusLabel.css';

const icons: Record<ApplicationStatus, LucideIconName> = {
  INTERESTED: 'bookmark', PLANNED: 'clock', APPLIED: 'fileText', DOCUMENT_PASSED: 'check',
  INTERVIEW: 'message', FINAL_PASSED: 'star', REJECTED: 'close', WITHDRAWN: 'rotateCcw',
};

export function JobStatusLabel({ status }: { status: ApplicationStatus }) {
  return <span className={`job-status-label job-status-label--${status.toLowerCase()}`}>
    <LucideIcon name={icons[status]} />{statusLabels[status]}
  </span>;
}
