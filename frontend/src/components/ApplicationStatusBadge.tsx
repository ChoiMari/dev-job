import { Badge } from './PixelArt';
import { statusLabels } from '../api/application-status';
import type { ApplicationStatus } from '../api/application-status';

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge icon={status === 'FINAL_PASSED' ? 'check' : 'grid'}
    tone={status === 'FINAL_PASSED' ? 'success' : status === 'REJECTED' || status === 'WITHDRAWN' ? 'error' : 'primary'}>
    {statusLabels[status]}
  </Badge>;
}
