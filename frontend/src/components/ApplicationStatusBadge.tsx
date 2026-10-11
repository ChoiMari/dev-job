import { Badge } from './PixelArt';
import { statusLabels } from '../api/application-status';
import type { ApplicationStatus } from '../api/application-status';

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge icon={status === 'PLANNED' ? 'clock'
    : status === 'APPLIED' || status === 'DOCUMENT_PASSED' || status === 'FINAL_PASSED' ? 'check'
      : status === 'INTERVIEW' ? 'calendar' : status === 'INTERESTED' ? 'bookmark' : 'error'}
    tone={status === 'APPLIED' || status === 'DOCUMENT_PASSED' || status === 'FINAL_PASSED' ? 'success'
      : status === 'REJECTED' || status === 'WITHDRAWN' ? 'error' : 'primary'}>
    {statusLabels[status]}
  </Badge>;
}
