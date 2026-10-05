export function LoadingState({ message = '불러오는 중입니다.' }: { message?: string }) {
  return <div className="state" role="status" aria-live="polite">
    <span className="spinner" aria-hidden="true" />
    <h2>불러오는 중</h2><p>{message}</p>
  </div>;
}

export function EmptyState({ title = '표시할 내용이 없습니다.', message }: { title?: string; message?: string }) {
  return <div className="state" role="status">
    <span className="state-icon" aria-hidden="true">◇</span>
    <h2>{title}</h2>{message && <p>{message}</p>}
  </div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="state error-state" role="alert">
    <span className="state-icon" aria-hidden="true">!</span>
    <h2>불러오지 못했습니다.</h2><p>{message}</p>
    {onRetry && <button type="button" onClick={onRetry}>다시 시도</button>}
  </div>;
}
