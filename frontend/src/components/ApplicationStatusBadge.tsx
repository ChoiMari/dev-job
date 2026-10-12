import { Badge } from './PixelArt';
import { newApplicationStatuses, statusLabels } from '../api/application-status';
import type { ApplicationStatus } from '../api/application-status';
import statusPixelStrip from '../assets/redesign/application-status-pixel-strip.png';
import './ApplicationStatusBadge.css';

// The generated icons are not centered in equal-width slices of the strip.
const iconOffsets = [-3, -24, -43.5, -63.5, -84.5, -114, -123];

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  if (status === 'INTERESTED') return <Badge icon="bookmark" tone="primary">{statusLabels[status]}</Badge>;
  const iconIndex = newApplicationStatuses.indexOf(status);
  const tone = status === 'APPLIED' || status === 'DOCUMENT_PASSED' || status === 'FINAL_PASSED' ? 'success'
    : status === 'REJECTED' || status === 'WITHDRAWN' ? 'error' : 'primary';
  return <span className={`badge badge--${tone} application-status-badge`}>
    <span className={`application-status-pixel application-status-pixel--${status.toLowerCase()}`} aria-hidden="true"
      style={{ backgroundImage: `url(${statusPixelStrip})`, backgroundPositionX: `${iconOffsets[iconIndex]}px` }} />
    <span>{statusLabels[status]}</span>
  </span>;
}
