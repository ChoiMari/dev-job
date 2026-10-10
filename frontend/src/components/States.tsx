import { Badge, PixelCharacter, PixelIcon } from './PixelArt';
import type { ReactNode } from 'react';

export function LoadingState({ message = '불러오는 중입니다.' }: { message?: string }) {
  return <div className="state" role="status" aria-live="polite">
    <span className="state-symbol loading-symbol" aria-hidden="true"><PixelIcon name="clock" /></span>
    <Badge tone="primary" icon="clock">로딩</Badge>
    <h2>불러오는 중</h2><p>{message}</p>
  </div>;
}

export function EmptyState({ title = '표시할 내용이 없습니다.', message, action }: {
  title?: string; message?: string; action?: ReactNode;
}) {
  return <div className="state" role="status">
    <span className="character-stage"><PixelCharacter /></span>
    <Badge icon="empty">빈 상태</Badge>
    <h2>{title}</h2>{message && <p>{message}</p>}{action && <div className="state-action">{action}</div>}
  </div>;
}

export function ErrorState({ title = '불러오지 못했습니다.', message, onRetry }: {
  title?: string; message: string; onRetry?: () => void;
}) {
  return <div className="state error-state" role="alert">
    <span className="state-symbol" aria-hidden="true"><PixelIcon name="error" /></span>
    <Badge tone="error" icon="error">오류</Badge>
    <h2>{title}</h2><p>{message}</p>
    {onRetry && <button type="button" onClick={onRetry}>다시 시도</button>}
  </div>;
}

export function SuccessState({ title = '완료되었습니다.', message, compact = false }: {
  title?: string; message?: string; compact?: boolean;
}) {
  return <div className={`state success-state${compact ? ' state--compact' : ''}`} role="status">
    <span className="character-stage"><PixelCharacter happy /></span>
    <div className="state-copy">
      <Badge tone="success" icon="check">완료</Badge>
      <h2>{title}</h2>{message && <p>{message}</p>}
    </div>
  </div>;
}
